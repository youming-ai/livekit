import pytest
from translate import Translator, TranslationError, other_lang


class FakeClient:
    def __init__(self, reply="  訳文  ", raises=False):
        self.reply = reply
        self.raises = raises
        self.last_prompt = None

    def generate(self, model, prompt):
        self.last_prompt = prompt
        if self.raises:
            raise RuntimeError("boom")
        return self.reply


def test_other_lang():
    assert other_lang("zh") == "ja"
    assert other_lang("ja") == "zh"


def test_translate_strips_output_and_builds_prompt():
    client = FakeClient(reply="  こんにちは  ")
    t = Translator(client)
    out = t.translate("你好", "zh", "ja")
    assert out == "こんにちは"
    assert "Chinese" in client.last_prompt and "Japanese" in client.last_prompt
    assert "你好" in client.last_prompt


def test_empty_text_returns_empty_without_calling_model():
    client = FakeClient()
    t = Translator(client)
    assert t.translate("   ", "zh", "ja") == ""
    assert client.last_prompt is None


def test_failure_raises_translation_error_with_original():
    client = FakeClient(raises=True)
    t = Translator(client)
    with pytest.raises(TranslationError) as ei:
        t.translate("你好", "zh", "ja")
    assert ei.value.original == "你好"
