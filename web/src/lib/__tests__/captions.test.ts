import { describe, it, expect } from "vitest";
import { parseCaption, type Caption } from "@/lib/captions";

const final: Caption = {
  type: "final",
  id: "seg_1",
  sid: "PA_x",
  speaker: "Tang",
  srcLang: "zh",
  original: "你好",
  tgtLang: "ja",
  translation: "こんにちは",
  ts: 1736668800000,
};

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe("captions protocol", () => {
  it("parses a final caption and keeps CJK verbatim", () => {
    expect(parseCaption(encode(final))).toEqual(final);
  });

  it("parses an interim caption", () => {
    const interim: Caption = { type: "interim", sid: "PA_x", speaker: "Tang", original: "你…" };
    expect(parseCaption(encode(interim))).toEqual(interim);
  });

  it("returns null for invalid JSON", () => {
    expect(parseCaption(new TextEncoder().encode("not json"))).toBeNull();
  });

  it("returns null when a required field is missing", () => {
    const bad = new TextEncoder().encode(JSON.stringify({ type: "final", id: "x" }));
    expect(parseCaption(bad)).toBeNull();
  });

  it("returns null for an invalid lang value", () => {
    const bad = new TextEncoder().encode(JSON.stringify({ ...final, srcLang: "en" }));
    expect(parseCaption(bad)).toBeNull();
  });
});
