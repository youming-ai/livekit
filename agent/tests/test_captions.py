import json
from captions import build_interim, build_final


def test_build_interim_matches_protocol():
    data = json.loads(build_interim("PA_x", "Tang", "你…").decode("utf-8"))
    assert data == {"type": "interim", "sid": "PA_x", "speaker": "Tang", "original": "你…"}


def test_build_final_matches_protocol_and_keeps_cjk():
    raw = build_final(
        id="seg1", sid="PA_x", speaker="Tang",
        src_lang="zh", original="你好", tgt_lang="ja",
        translation="こんにちは", ts=1736668800000,
    )
    # CJK kept as-is, not \uXXXX escaped
    assert "こんにちは".encode("utf-8") in raw
    data = json.loads(raw.decode("utf-8"))
    assert data == {
        "type": "final", "id": "seg1", "sid": "PA_x", "speaker": "Tang",
        "srcLang": "zh", "original": "你好", "tgtLang": "ja",
        "translation": "こんにちは", "ts": 1736668800000,
    }
