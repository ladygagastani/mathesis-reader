import { describe, expect, it } from "vitest";
import { bcAd } from "./bc-ad";

describe("BC and AD", () => {
  it("turns BCE and CE into the site's convention", () => {
    expect(bcAd("c. 20 BCE-c. 50 CE")).toBe("c. 20 BC – c. AD 50");
    expect(bcAd("2nd century CE")).toBe("2nd century AD");
    expect(bcAd("ca. 14–68 CE")).toBe("ca. AD 14–68");
    expect(bcAd("ca. 27 BCE–68 CE")).toBe("ca. 27 BC – AD 68");
    expect(bcAd("1st centuries BCE and CE")).toBe("1st centuries BC and AD");
    expect(bcAd("1st century BCE–1st century CE")).toBe("1st century BC–1st century AD");
    expect(bcAd("Greek philosopher (c. 460–c. 370 BC)")).toBe("Greek philosopher (c. 460–c. 370 BC)");
  });
});
