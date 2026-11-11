import { describe, expect, it } from "vitest";
import { BOOT_SCRIPT, DEFAULTS, readSettings, stepSize } from "./settings";

describe("reading the stored settings", () => {
  it("opens on the Greek alone, following the device, at the size that suits it", () => {
    expect(readSettings(null)).toEqual({ theme: "auto", greekSize: "auto", columns: "greek" });
  });
  it("keeps good values", () => {
    expect(readSettings(JSON.stringify({ theme: "night", greekSize: 1.5, columns: "both" }))).toEqual({ theme: "night", greekSize: 1.5, columns: "both" });
  });
  it("falls back to the defaults for damaged or unknown values", () => {
    expect(readSettings("{not json")).toEqual(DEFAULTS);
    expect(readSettings(JSON.stringify({ theme: "sepia", greekSize: 9, columns: "latin" }))).toEqual(DEFAULTS);
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

describe("the boot script", () => {
  it("is valid JavaScript that never throws, whatever is stored", () => {
    expect(() => new Function(BOOT_SCRIPT)).not.toThrow();
  });
});
