"""Diarized multi-speaker transcription + translation agent.

Path A (livekit-plugins-deepgram) was chosen because:
  - deepgram.STT.__init__ accepts enable_diarization=True (confirmed via probe)
  - stt.SpeechData.speaker_id field exists (str | None, format "S{int}" for finals,
    None for interim — confirmed via probe of live_transcription_to_speech_data source)
  - stt.SpeechStream supports push_frame / async-for / context manager (confirmed)
  - No need for the raw deepgram-sdk; the plugin surfaces all required data.

Speaker index extraction:
  - Final  : speaker_id = "S0", "S1", … → strip "S" prefix, parse int. None → 0.
  - Interim: speaker_id is always None (plugin explicitly sets None for interims) → default 0.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid

from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.plugins import deepgram

from captions import build_final, build_interim
from diarize import speaker_label, speaker_sid
from translate import GeminiClient, TranslationError, Translator, other_lang

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("transcriber")

# Languages supported for spoken/target routing
_SUPPORTED_SPOKEN = {"zh", "ja"}

# Deepgram language codes for each supported spoken language
_DG_LANG: dict[str, str] = {"zh": "zh", "ja": "ja"}


def _speaker_int(speaker_id: str | None) -> int:
    """Normalise a SpeechData.speaker_id to a plain integer index.

    The livekit-plugins-deepgram plugin formats speaker_id as "S{n}" (e.g. "S0", "S1").
    For interims, speaker_id is always None → default to 0.
    Handles unexpected formats gracefully.
    """
    if speaker_id is None:
        return 0
    try:
        # Expected format: "S0", "S1", …
        stripped = speaker_id.lstrip("Ss").strip()
        return int(stripped)
    except ValueError:
        logger.warning("Unexpected speaker_id format: %r — defaulting to 0", speaker_id)
        return 0


async def _transcribe_track(
    track: rtc.AudioTrack,
    participant: rtc.RemoteParticipant,
    local_participant: rtc.LocalParticipant,
    translator: Translator,
) -> None:
    """Stream one audio track through Deepgram with diarization, publish bilingual captions."""
    spoken = participant.attributes.get("spoken_lang", "zh")
    if spoken not in _SUPPORTED_SPOKEN:
        spoken = "zh"
    tgt = other_lang(spoken)
    device_name: str = participant.name or participant.identity
    identity: str = participant.identity
    dg_lang = _DG_LANG[spoken]

    logger.info(
        "Starting transcription for %s (spoken=%s, tgt=%s)",
        device_name,
        spoken,
        tgt,
    )

    stt_engine = deepgram.STT(
        model="nova-3",
        language=dg_lang,
        enable_diarization=True,
        interim_results=True,
        punctuate=True,
    )

    audio_stream = rtc.AudioStream(
        track,
        sample_rate=16000,
        num_channels=1,
    )

    try:
        async with stt_engine.stream(language=dg_lang) as stt_stream:
            # Feed audio frames concurrently while consuming speech events
            async def _feed_audio() -> None:
                async for audio_event in audio_stream:
                    stt_stream.push_frame(audio_event.frame)
                stt_stream.end_input()

            feed_task = asyncio.create_task(_feed_audio())

            try:
                async for speech_event in stt_stream:
                    await _handle_speech_event(
                        speech_event=speech_event,
                        identity=identity,
                        device_name=device_name,
                        spoken=spoken,
                        tgt=tgt,
                        local_participant=local_participant,
                        translator=translator,
                    )
            finally:
                feed_task.cancel()
                try:
                    await feed_task
                except asyncio.CancelledError:
                    pass
    except Exception:
        logger.exception("Error in transcribe_track for %s", device_name)


async def _handle_speech_event(
    *,
    speech_event: agents.stt.SpeechEvent,
    identity: str,
    device_name: str,
    spoken: str,
    tgt: str,
    local_participant: rtc.LocalParticipant,
    translator: Translator,
) -> None:
    from livekit.agents.stt import SpeechEventType

    if not speech_event.alternatives:
        return

    alt = speech_event.alternatives[0]
    text = alt.text.strip()

    if not text:
        return

    spk_idx = _speaker_int(alt.speaker_id)
    sid = speaker_sid(identity, spk_idx)
    speaker = speaker_label(device_name, spk_idx)

    if speech_event.type == SpeechEventType.INTERIM_TRANSCRIPT:
        payload = build_interim(sid=sid, speaker=speaker, original=text)
        await local_participant.publish_data(payload, reliable=False, topic="captions")

    elif speech_event.type == SpeechEventType.FINAL_TRANSCRIPT:
        try:
            translation = await asyncio.to_thread(
                translator.translate, text, spoken, tgt
            )
        except TranslationError:
            translation = "(翻译失败)"

        payload = build_final(
            id=str(uuid.uuid4()),
            sid=sid,
            speaker=speaker,
            src_lang=spoken,
            original=text,
            tgt_lang=tgt,
            translation=translation,
            ts=int(time.time() * 1000),
        )
        await local_participant.publish_data(payload, reliable=True, topic="captions")


async def entrypoint(ctx: agents.JobContext) -> None:
    await ctx.connect()

    translator = Translator(
        GeminiClient(os.environ["GOOGLE_API_KEY"]),
        model=os.environ.get("TRANSLATE_MODEL", "gemini-2.5-flash"),
    )

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ) -> None:
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            asyncio.ensure_future(
                _transcribe_track(
                    track=track,  # type: ignore[arg-type]
                    participant=participant,
                    local_participant=ctx.room.local_participant,
                    translator=translator,
                )
            )


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
