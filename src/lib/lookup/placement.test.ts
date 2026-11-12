import { describe, expect, it } from "vitest";
import { FLOAT, FLOAT_FROM, floatAt, lookupPlace } from "./placement";

// One rule decides where the look-up opens (DESIGN.md, decision 1): a card by the word, or a sheet on a phone
describe("where the look-up opens", () => {
  it("is a sheet on a phone", () => {
    expect(lookupPlace(390)).toBe("sheet");
    expect(lookupPlace(FLOAT_FROM - 1)).toBe("sheet");
  });
  it("floats by the word on a tablet or a computer", () => {
    expect(lookupPlace(FLOAT_FROM)).toBe("float");
    expect(lookupPlace(1440)).toBe("float");
  });
});

describe("the floating card", () => {
  const view = { width: 1440, height: 900, top: 60 };
  const word = (top: number, left = 600, w = 80, h = 30) => ({ top, bottom: top + h, left, right: left + w });
  const overlaps = (w: ReturnType<typeof word>, f: ReturnType<typeof floatAt>, h: number) =>
    !(f.top + Math.min(h, f.maxHeight) <= w.top - f.scroll || f.top >= w.bottom - f.scroll || f.left + f.width <= w.left || f.left >= w.right);

  it("opens under a word high on the screen, centred on it", () => {
    const w = word(200);
    const f = floatAt(w, 320, view);
    expect(f.side).toBe("below");
    expect(f.top).toBe(w.bottom + FLOAT.gap);
    expect(f.left + f.width / 2).toBe(640);
    expect(f.scroll).toBe(0);
  });

  it("opens over a word low on the screen", () => {
    const w = word(780);
    const f = floatAt(w, 320, view);
    expect(f.side).toBe("above");
    expect(f.top + 320).toBe(w.top - FLOAT.gap);
    expect(overlaps(w, f, 320)).toBe(false);
  });

  it("opens a card still loading on the side the whole card will have room on", () => {
    const w = word(620);
    expect(floatAt(w, 90, view).side).toBe("above");
    expect(floatAt(w, 400, view).side).toBe("above");
  });

  it("stays under the word when there is room enough, letting a tall card scroll inside", () => {
    const w = word(300);
    const f = floatAt(w, 1200, view);
    expect(f.side).toBe("below");
    expect(f.maxHeight).toBe(900 - FLOAT.edge - w.bottom - FLOAT.gap);
  });

  it("keeps inside the window at its edges", () => {
    expect(floatAt(word(200, 4, 40), 300, view).left).toBe(FLOAT.edge);
    const f = floatAt(word(200, 1400, 40), 300, view);
    expect(f.left + f.width).toBe(1440 - FLOAT.edge);
  });

  it("is never wider than the window allows", () => {
    expect(floatAt(word(200, 300), 300, { width: 780, height: 1000, top: 60 }).width).toBe(FLOAT.width);
    expect(floatAt(word(200, 100), 300, { width: 400, height: 800, top: 60 }).width).toBe(400 - 2 * FLOAT.edge);
  });

  it("scrolls the word up when neither side has room, and never covers it", () => {
    const short = { width: 1440, height: 500, top: 60 };
    const w = word(240);
    const f = floatAt(w, 600, short);
    expect(f.scroll).toBe(240 - 60 - FLOAT.edge);
    expect(f.side).toBe("below");
    expect(overlaps(w, f, 600)).toBe(false);
  });
});
