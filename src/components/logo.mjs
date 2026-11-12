// The logo's drawing, on a square 100 units across: a heavy Σ standing upright on a red square turned 45° (the owner's choice of
// 2026-11-12, replacing the round seal). Mark.tsx draws it in the masthead, and scripts/make-logo.mjs makes the tab icon and the
// iPhone's home-screen icon from the same shapes.

/** the red square, turned on its corner */
export const DIAMOND = { x: 15, y: 15, size: 70, rx: 9, transform: "rotate(45 50 50)" };

/** the Σ, drawn as one solid shape so that it stays heavy at 16 px, and where it sits inside the diamond */
export const SIGMA = { d: "M22 16H80V32H46L64 50L46 68H80V84H22V74L46 50L22 26Z", transform: "translate(18.4 19) scale(0.62)" };

/** the whole logo as SVG markup, in the colours given (scripts/make-logo.mjs) */
export function logoSvg(px, { red, letter, ground = "none" }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100">`
    + `<rect width="100" height="100" fill="${ground}"/>`
    + `<rect x="${DIAMOND.x}" y="${DIAMOND.y}" width="${DIAMOND.size}" height="${DIAMOND.size}" rx="${DIAMOND.rx}" transform="${DIAMOND.transform}" fill="${red}"/>`
    + `<path d="${SIGMA.d}" transform="${SIGMA.transform}" fill="${letter}"/></svg>`;
}
