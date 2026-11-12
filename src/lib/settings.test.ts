import { describe, expect, it } from "vitest";
import { BOOT_SCRIPT, DEFAULTS, readSettings, stepLeading, stepSize } from "./settings";

describe("reading the stored settings", () => {
  it("opens on the Greek alone, following the device, at the size that suits it", () => {
    expect(readSettings(null)).toEqual({ theme: "auto", greekSize: "auto", columns: "greek", leading: "auto" });
  });
  it("keeps good values", () => {
    expect(readSettings(JSON.stringify({ theme: "night", greekSize: 1.5, columns: "both", leading: 1.8 }))).toEqual({ theme: "night", greekSize: 1.5, columns: "both", leading: 1.8 });
    // (settings kept before the line spacing existed)
    expect(readSettings(JSON.stringify({ theme: "paper", greekSize: "auto", columns: "greek" }))).toEqual({ theme: "paper", greekSize: "auto", columns: "greek", leading: "auto" });
  });
  it("falls back to the defaults for damaged or unknown values", () => {
    expect(readSettings("{not json")).toEqual(DEFAULTS);
    expect(readSettings(JSON.stringify({ theme: "sepia", greekSize: 9, columns: "latin", leading: 3 }))).toEqual(DEFAULTS);
    expect(readSettings("null")).toEqual(DEFAULTS);
  });
});

describe("a size step", () => {
  it("starts from the size the page shows, to the nearest step", () => {
    expect(stepSize("auto", 1, 1.6)).toBe(1.75);
    expect(stepSize("auto", -1, 1.6)).toBe(1.5);
  });
  it("stays within the limits", () => {
    expect(stepSize(2, 1, 0)).toBe(2);
    expect(stepSize(1, -1, 0)).toBe(1);
  });
});

describe("a line-spacing step", () => {
  it("starts from the design's 1.65 and moves a tenth at a time", () => {
    expect(stepLeading("auto", 1)).toBe(1.75);
    expect(stepLeading(1.8, -1)).toBe(1.7);
  });
  it("stays within the limits", () => {
    expect(stepLeading(2, 1)).toBe(2);
    expect(stepLeading(1.4, -1)).toBe(1.4);
  });
});

describe("the boot script", () => {
  it("is valid JavaScript that never throws, whatever is stored", () => {
    expect(() => new Function(BOOT_SCRIPT)).not.toThrow();
  });
});
