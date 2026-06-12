import { describe, it, expect } from "vitest";
import { validateJoin } from "@/lib/join";

describe("validateJoin", () => {
  it("accepts valid input and trims", () => {
    const r = validateJoin({ name: " Tang ", room: " m1 ", spokenLang: "zh" });
    expect(r).toEqual({ ok: true, value: { name: "Tang", room: "m1", spokenLang: "zh" } });
  });
  it("rejects empty name", () => {
    expect(validateJoin({ name: "", room: "m1", spokenLang: "zh" }).ok).toBe(false);
  });
  it("rejects empty room", () => {
    expect(validateJoin({ name: "Tang", room: "", spokenLang: "zh" }).ok).toBe(false);
  });
  it("rejects invalid lang", () => {
    expect(validateJoin({ name: "Tang", room: "m1", spokenLang: "en" }).ok).toBe(false);
  });
});
