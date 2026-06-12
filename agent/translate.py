from __future__ import annotations

import logging
from typing import Protocol

logger = logging.getLogger(__name__)

LANG_NAMES = {"zh": "Chinese (Simplified)", "ja": "Japanese"}


def other_lang(lang: str) -> str:
    return "ja" if lang == "zh" else "zh"


class TranslationError(Exception):
    def __init__(self, original: str) -> None:
        super().__init__("translation failed")
        self.original = original


class GenAIClient(Protocol):
    def generate(self, model: str, prompt: str) -> str: ...


class Translator:
    def __init__(self, client: GenAIClient, model: str = "gemini-2.5-flash") -> None:
        self._client = client
        self._model = model

    def translate(self, text: str, src: str, tgt: str) -> str:
        if not text.strip():
            return ""
        prompt = (
            f"Translate the following {LANG_NAMES[src]} text into {LANG_NAMES[tgt]}. "
            f"Output only the translation, with no quotes or explanations.\n\n{text}"
        )
        try:
            out = self._client.generate(self._model, prompt)
        except Exception as exc:  # noqa: BLE001
            logger.exception("translation failed")
            raise TranslationError(text) from exc
        return out.strip()


class GeminiClient:
    """Thin adapter over google-genai implementing GenAIClient."""

    def __init__(self, api_key: str) -> None:
        from google import genai

        self._client = genai.Client(api_key=api_key)

    def generate(self, model: str, prompt: str) -> str:
        resp = self._client.models.generate_content(model=model, contents=prompt)
        return resp.text or ""
