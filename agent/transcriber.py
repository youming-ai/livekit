"""Participant-based transcription + translation agent.

Each participant joins from their own browser/device and publishes a separate
LiveKit audio track. Speaker attribution therefore comes from the LiveKit
participant identity/name rather than single-microphone voice separation.
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
from speakers import speaker_label, speaker_sid
from translate import GeminiClient, TranslationError, Translator, other_lang

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("transcriber")

# Languages supported for spoken/target routing
_SUPPORTED_SPOKEN = {"zh", "ja"}

# Deepgram language codes for each supported spoken language
_DG_LANG: dict[str, str] = {"zh": "zh", "ja": "ja"}


async def _transcribe_track(
    track: rtc.AudioTrack,
    participant: rtc.RemoteParticipant,
    local_participant: rtc.LocalParticipant,
    translator: Translator,
) -> None:
    """Stream one participant audio track through Deepgram and publish captions."""
    spoken = participant.attributes.get("spoken_lang", "zh")
    if spoken not in _SUPPORTED_SPOKEN:
        spoken = "zh"
    tgt = other_lang(spoken)
    speaker_sid_value = speaker_sid(participant.identity)
    speaker_name = speaker_label(participant.name, participant.identity)
    dg_lang = _DG_LANG[spoken]

    logger.info(
        "Starting transcription for %s (spoken=%s, tgt=%s)",
        speaker_name,
        spoken,
        tgt,
    )

    stt_engine = deepgram.STT(
        model="nova-3",
        language=dg_lang,
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
                        speaker_sid_value=speaker_sid_value,
                        speaker_name=speaker_name,
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
        logger.exception("Error in transcribe_track for %s", speaker_name)
    finally:
        # AudioStream has no async-context-manager support; close it explicitly so the
        # background FFI queue subscription is released even on the error path.
        await audio_stream.aclose()


async def _handle_speech_event(
    *,
    speech_event: agents.stt.SpeechEvent,
    speaker_sid_value: str,
    speaker_name: str,
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

    if speech_event.type == SpeechEventType.INTERIM_TRANSCRIPT:
        payload = build_interim(
            sid=speaker_sid_value,
            speaker=speaker_name,
            original=text,
        )
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
            sid=speaker_sid_value,
            speaker=speaker_name,
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
