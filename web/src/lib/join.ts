import type { Lang } from "./captions";

export interface JoinInput {
  name: string;
  room: string;
  spokenLang: Lang;
}

type Result =
  | { ok: true; value: JoinInput }
  | { ok: false; error: string };

export function validateJoin(input: {
  name?: string;
  room?: string;
  spokenLang?: string;
}): Result {
  const name = (input.name ?? "").trim();
  const room = (input.room ?? "").trim();
  if (!room) return { ok: false, error: "请输入房间号" };
  if (!name) return { ok: false, error: "请输入名称" };
  if (input.spokenLang !== "zh" && input.spokenLang !== "ja") {
    return { ok: false, error: "请先选择语言" };
  }
  return { ok: true, value: { name, room, spokenLang: input.spokenLang } };
}
