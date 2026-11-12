import { describe, expect, it } from "vitest";
import { titleCaps } from "./authors";

describe("Greek in capitals", () => {
  it("drops the accents and breathings, as print does", () => {
    expect(titleCaps("Πλάτων")).toBe("ΠΛΑΤΩΝ");
    expect(titleCaps("Ἡρόδοτος")).toBe("ΗΡΟΔΟΤΟΣ");
    expect(titleCaps("Ἀριστοφάνης")).toBe("ΑΡΙΣΤΟΦΑΝΗΣ");
  });
});
