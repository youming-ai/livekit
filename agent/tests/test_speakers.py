from speakers import speaker_label, speaker_sid


def test_speaker_sid_uses_participant_identity():
    assert speaker_sid("tang-abc") == "tang-abc"


def test_speaker_label_prefers_display_name():
    assert speaker_label("小明", "ming-abc") == "小明"


def test_speaker_label_falls_back_to_identity():
    assert speaker_label("", "ming-abc") == "ming-abc"
    assert speaker_label(None, "ming-abc") == "ming-abc"
