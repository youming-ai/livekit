import { describe, it, expect } from "vitest";
import { captionReducer, emptyStore } from "@/lib/captionStore";
import type { Caption } from "@/lib/captions";

const interim = (sid: string, text: string): Caption => ({
  type: "interim", sid, speaker: sid, original: text,
});
const final = (id: string, sid: string): Caption => ({
  type: "final", id, sid, speaker: sid,
  srcLang: "zh", original: "你好", tgtLang: "ja", translation: "こんにちは", ts: 1,
});

describe("captionReducer", () => {
  it("stores an interim keyed by sid", () => {
    const s = captionReducer(emptyStore, interim("A", "你…"));
    expect(s.interims["A"].original).toBe("你…");
  });

  it("replaces an earlier interim from the same sid", () => {
    let s = captionReducer(emptyStore, interim("A", "你…"));
    s = captionReducer(s, interim("A", "你好…"));
    expect(s.interims["A"].original).toBe("你好…");
  });

  it("appends a final and clears that sid's interim", () => {
    let s = captionReducer(emptyStore, interim("A", "你…"));
    s = captionReducer(s, final("seg1", "A"));
    expect(s.finals).toHaveLength(1);
    expect(s.interims["A"]).toBeUndefined();
  });

  it("does not clear another sid's interim on final", () => {
    let s = captionReducer(emptyStore, interim("B", "ま…"));
    s = captionReducer(s, final("seg1", "A"));
    expect(s.interims["B"].original).toBe("ま…");
  });

  it("dedupes finals by id", () => {
    let s = captionReducer(emptyStore, final("seg1", "A"));
    s = captionReducer(s, final("seg1", "A"));
    expect(s.finals).toHaveLength(1);
  });
});
