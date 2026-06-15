from diarize import speaker_sid, speaker_label


def test_speaker_sid_combines_identity_and_index():
    assert speaker_sid("tang-abc", 0) == "tang-abc#0"
    assert speaker_sid("tang-abc", 2) == "tang-abc#2"


def test_speaker_label_is_one_based_with_device_name():
    assert speaker_label("会议室A", 0) == "会议室A · 说话人1"
    assert speaker_label("会议室A", 1) == "会议室A · 说话人2"
