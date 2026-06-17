import { createServerFn } from "@tanstack/react-start";
import { buildAccessToken } from "@/lib/token";
import { validateJoin } from "@/lib/join";
import type { Lang } from "@/lib/captions";

export interface RequestTokenInput {
  room: string;
  name: string;
  lang: Lang;
}

export const requestToken = createServerFn({ method: "POST" })
  .validator((input: RequestTokenInput) => {
    const r = validateJoin({
      name: input.name,
      room: input.room,
      spokenLang: input.lang,
    });
    if (!r.ok) throw new Error(r.error);
    return r.value; // { name, room, spokenLang }
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL;
    if (!apiKey || !apiSecret || !url) {
      throw new Error("服务端未配置 LiveKit 凭据");
    }
    const identity = `${data.name}-${Math.random().toString(36).slice(2, 8)}`;
    const token = await buildAccessToken(apiKey, apiSecret, {
      room: data.room,
      name: data.name,
      identity,
      spokenLang: data.spokenLang,
    });
    return { token, url };
  });
