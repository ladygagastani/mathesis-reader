import { describe, expect, it } from "vitest";
import { parseSyncCode, showSyncCode } from "./sync-code";

describe("reading a typed sync code", () => {
  it("takes the code as the database prints it", () => {
    expect(parseSyncCode("7K3Q-9XWD-M2RT-0HVB-PZ4N")).toBe("7K3Q9XWDM2RT0HVBPZ4N");
  });
  it("forgives case, spaces, and letters that look like digits", () => {
    expect(parseSyncCode(" 7k3q 9xwd m2rt ohvb pz4n ")).toBe("7K3Q9XWDM2RT0HVBPZ4N");
    expect(parseSyncCode("iiii-llll-oooo-0000-1111")).toBe("11111111000000001111");
  });
  it("refuses a code of the wrong length or with a letter Crockford leaves out", () => {
    expect(parseSyncCode("7K3Q-9XWD-M2RT-0HVB")).toBeNull();
    expect(parseSyncCode("7K3Q-9XWD-M2RT-0HVB-PZ4NA")).toBeNull();
    expect(parseSyncCode("UK3Q-9XWD-M2RT-0HVB-PZ4N")).toBeNull();
    expect(parseSyncCode("")).toBeNull();
  });
  it("shows it again in fives of four", () => {
    expect(showSyncCode(parseSyncCode("7k3q9xwdm2rt0hvbpz4n")!)).toBe("7K3Q-9XWD-M2RT-0HVB-PZ4N");
  });
});
