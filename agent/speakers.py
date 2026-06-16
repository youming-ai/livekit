from __future__ import annotations


def speaker_sid(identity: str) -> str:
    return identity


def speaker_label(name: str | None, identity: str) -> str:
    display_name = (name or "").strip()
    return display_name or identity
