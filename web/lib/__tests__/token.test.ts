// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildAccessToken } from "@/lib/token";

function decodePayload(jwt: string): any {
  const [, payload] = jwt.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString());
}

describe("buildAccessToken", () => {
  it("issues a JWT granting room join with the spoken_lang attribute", async () => {
    const jwt = await buildAccessToken("devkey", "devsecret-at-least-32-chars-long!!", {
      room: "meeting1",
      identity: "tang-abc",
      name: "Tang",
      spokenLang: "zh",
    });
    expect(jwt.split(".")).toHaveLength(3);
    const p = decodePayload(jwt);
    expect(p.video.room).toBe("meeting1");
    expect(p.video.roomJoin).toBe(true);
    expect(p.attributes.spoken_lang).toBe("zh");
  });
});
