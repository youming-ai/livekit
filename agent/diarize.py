from __future__ import annotations


def speaker_sid(identity: str, speaker: int) -> str:
    return f"{identity}#{speaker}"


def speaker_label(device_name: str, speaker: int) -> str:
    return f"{device_name} · 说话人{speaker + 1}"
