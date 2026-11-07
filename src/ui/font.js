// 3x5 bitmap font, drawn pixel by pixel. No browser fonts, no anti-aliasing.
const G = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101110100110101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001110',
  ' ': '000000000000000', '!': '010010010000010', '.': '000000000000010', ':': '000010000010000',
  '/': '001001010100100', '-': '000000111000000', '?': '110001010000010', ',': '000000000010100',
  "'": '010010000000000', '+': '000010111010000', 'x': '000101010101000',
};

export function textWidth(str, scale = 1) {
  return Math.max(0, str.length * 4 - 1) * scale;
}

function glyph(g, ch, x, y, color, s) {
  const bits = G[ch] || G[' '];
  g.fillStyle = color;
  for (let i = 0; i < 15; i++) {
    if (bits[i] === '1') g.fillRect(x + (i % 3) * s, y + Math.floor(i / 3) * s, s, s);
  }
}

// align: 'left' | 'center' | 'right'. shadow: color or null.
export function drawText(g, str, x, y, color, { scale = 1, align = 'left', shadow = null } = {}) {
  str = String(str).toUpperCase();
  const w = textWidth(str, scale);
  let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  y = Math.round(y);
  if (shadow) {
    let sx = cx;
    for (const ch of str) { glyph(g, ch, sx, y + scale, shadow, scale); sx += 4 * scale; }
  }
  for (const ch of str) { glyph(g, ch, cx, y, color, scale); cx += 4 * scale; }
}
