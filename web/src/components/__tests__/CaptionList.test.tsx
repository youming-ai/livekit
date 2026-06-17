import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaptionList } from "@/components/CaptionList";
import type { CaptionStore } from "@/lib/captionStore";

const store: CaptionStore = {
  finals: [
    {
      type: "final", id: "s1", sid: "A", speaker: "Tang",
      srcLang: "zh", original: "你好", tgtLang: "ja", translation: "こんにちは", ts: 1,
    },
  ],
  interims: { B: { type: "interim", sid: "B", speaker: "Sato", original: "ええと…" } },
};

describe("CaptionList", () => {
  it("renders a finalized line with original and translation", () => {
    render(<CaptionList store={store} />);
    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(screen.getByText("こんにちは")).toBeInTheDocument();
    expect(screen.getByText("Tang")).toBeInTheDocument();
  });

  it("renders an interim line for the live speaker", () => {
    render(<CaptionList store={store} />);
    expect(screen.getByText("ええと…")).toBeInTheDocument();
    expect(screen.getByTestId("interim")).toHaveAttribute("data-sid", "B");
  });
});
