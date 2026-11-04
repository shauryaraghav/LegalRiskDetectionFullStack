import { describe, expect, it } from "vitest";
import { errorMessage } from "./api";
import { highlightParts, pct, riskTone, titleCase, wordDiff } from "./lib";

describe("highlightParts", () => {
  it("marks whole-word, case-insensitive matches", () => {
    const parts = highlightParts("The Company may Terminate without notice.", ["terminate", "without notice"]);
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(["Terminate", "without notice"]);
    expect(parts.map((p) => p.text).join("")).toBe("The Company may Terminate without notice.");
  });
  it("does not match inside other words and tolerates regex characters", () => {
    expect(highlightParts("determinate", ["terminate"]).some((p) => p.hit)).toBe(false);
    expect(highlightParts("pay (30) days", ["(30)", "a.b"]).map((p) => p.text).join("")).toBe("pay (30) days");
  });
  it("returns the text untouched when there are no usable terms", () => {
    expect(highlightParts("Hello world", ["", "ab"])).toEqual([{ text: "Hello world", hit: false }]);
  });
});

describe("helpers", () => {
  it("maps risk labels to tones", () => {
    expect(riskTone("High")).toBe("high");
    expect(riskTone("MEDIUM")).toBe("medium");
    expect(riskTone("")).toBe("none");
  });
  it("formats", () => {
    expect(titleCase("Intellectual_Property")).toBe("Intellectual Property");
    expect(pct(0.818, 1)).toBe("81.8%");
    expect(pct(null)).toBe("—");
  });
  it("reads FastAPI error shapes", () => {
    expect(errorMessage({ detail: "Nope." }, "x")).toBe("Nope.");
    expect(errorMessage({ detail: [{ msg: "Value error, Enter a valid email address." }] }, "x")).toBe("Enter a valid email address.");
    expect(errorMessage(null, "fallback")).toBe("fallback");
  });
});

describe("wordDiff", () => {
  it("marks only the words that really changed", () => {
    const d = wordDiff("The Company may terminate without notice.", "The Company may terminate on 60 days written notice.");
    expect(d.a.filter((p) => p.changed).map((p) => p.text)).toEqual(["without"]);
    expect(d.b.filter((p) => p.changed).map((p) => p.text)).toEqual(["on", "60", "days", "written"]);
  });
  it("does not mark a repeated word that was already present", () => {
    const d = wordDiff("The fee is due.", "The fee is due on the first day.");
    expect(d.b[0]).toEqual({ text: "The", changed: false });
  });
  it("reassembles to the original text", () => {
    const d = wordDiff("a b c", "a x c");
    expect(d.a.map((p) => p.text).join("")).toBe("a b c");
    expect(d.b.map((p) => p.text).join("")).toBe("a x c");
  });
});
