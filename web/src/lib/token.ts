import { AccessToken } from "livekit-server-sdk";
import type { Lang } from "./captions";

export interface TokenParams {
  room: string;
  identity: string;
  name: string;
  spokenLang: Lang;
}

export async function buildAccessToken(
  apiKey: string,
  apiSecret: string,
  params: TokenParams,
): Promise<string> {
  const at = new AccessToken(apiKey, apiSecret, {
    identity: params.identity,
    name: params.name,
    attributes: { spoken_lang: params.spokenLang },
  });
  at.addGrant({
    room: params.room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });
  return at.toJwt();
}
