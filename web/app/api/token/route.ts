import { NextRequest, NextResponse } from "next/server";
import { buildAccessToken } from "@/lib/token";
import type { Lang } from "@/lib/captions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json({ error: "服务端未配置 LiveKit 凭据" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const room = typeof b.room === "string" ? b.room.trim() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const spokenLang = b.spokenLang;
  if (!room || !name || (spokenLang !== "zh" && spokenLang !== "ja")) {
    return NextResponse.json({ error: "缺少或非法的字段：room/name/spokenLang" }, { status: 400 });
  }

  const identity = `${name}-${Math.random().toString(36).slice(2, 8)}`;
  const token = await buildAccessToken(apiKey, apiSecret, {
    room,
    name,
    identity,
    spokenLang: spokenLang as Lang,
  });
  return NextResponse.json({ token, url });
}
