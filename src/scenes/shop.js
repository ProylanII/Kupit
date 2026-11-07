// Sari-sari store (permanent upgrades) and character select. Both are simple scrolling-free lists.
import { drawText } from '../ui/font.js';
import { drawButton, buttonRect, hit } from '../ui/menu.js';
import { drawCoin, drawActor, drawPortrait } from '../render/sprites.js';
import { C } from '../render/palette.js';
import { VIEW_W } from '../core/input.js';
import { sfx } from '../core/audio.js';
import {
  UPGRADES, UPGRADE_ORDER, CHARACTERS, CHAR_ORDER,
  upgradeCost, buyUpgrade, pickChar, owns,
} from '../game/progression.js';

const ROW_Y = 44;
const rowRect = (i, rowH) => ({ x: 10, y: ROW_Y + i * rowH, w: VIEW_W - 20, h: rowH - 4 });
const backRect = () => buttonRect(0, 332, 22, 100);

// ctx = { save, persist(), back() }
function makeList({ title, items, rowH, drawRow, pick }) {
  const s = {
    sel: 0,
    msg: null, msgT: 0,
    say(text, color = C.yellow) { s.msg = { text, color }; s.msgT = 2; },
    update(input, ctx, dt = 1 / 60) {
      const n = items.length;
      if ((s.msgT -= dt) <= 0) s.msg = null;
      if (input.pressed('ArrowUp') || input.pressed('w')) s.sel = (s.sel + n) % (n + 1);
      if (input.pressed('ArrowDown') || input.pressed('s')) s.sel = (s.sel + 1) % (n + 1);
      if (input.pressed('Escape')) { ctx.back(); return; }
      let p = -1;
      const tp = input.tapPos;
      if (tp) {
        if (hit(tp, backRect())) p = n;
        else for (let i = 0; i < n; i++) if (hit(tp, rowRect(i, rowH))) p = i;
        if (p >= 0) s.sel = p;
      }
      if (p < 0 && (input.pressed('Enter') || input.pressed(' ') || input.pressed('e'))) p = s.sel;
      if (p < 0) return;
      sfx.unlock();
      if (p === n) ctx.back();
      else pick(items[p], ctx, s);
    },
    draw(g, ctx) {
      g.fillStyle = C.ink; g.fillRect(0, 0, 240, 392);
      drawText(g, title, VIEW_W / 2, 12, C.gold, { scale: 2, align: 'center', shadow: C.gold2 });
      drawCoin(g, 88, 30);
      drawText(g, `YOUR COINS: ${ctx.save.bank}`, 96, 31, C.white);
      items.forEach((id, i) => {
        const r = rowRect(i, rowH);
        g.fillStyle = s.sel === i ? C.gold : C.ink; g.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
        g.fillStyle = C.wallD; g.fillRect(r.x, r.y, r.w, r.h);
        drawRow(g, id, r, ctx);
      });
      if (s.msg) drawText(g, s.msg.text, VIEW_W / 2, 318, s.msg.color, { align: 'center' });
      drawButton(g, backRect(), 'BACK', s.sel === items.length);
    },
  };
  return s;
}

function pips(g, x, y, have, max) {
  for (let i = 0; i < max; i++) { g.fillStyle = C.ink; g.fillRect(x + i * 11, y, 9, 7); g.fillStyle = i < have ? C.gold : C.dgray; g.fillRect(x + i * 11 + 1, y + 1, 7, 5); }
}

export const shopScreen = makeList({
  title: 'SARI-SARI STORE',
  items: UPGRADE_ORDER,
  rowH: 42,
  drawRow(g, id, r, { save }) {
    const u = UPGRADES[id], have = save.upgrades[id] | 0, cost = upgradeCost(save, id);
    const afford = cost !== null && save.bank >= cost;
    drawText(g, u.name, r.x + 6, r.y + 6, C.white);
    drawText(g, u.desc, r.x + 6, r.y + 18, C.gray);
    pips(g, r.x + r.w - 38, r.y + 5, have, u.costs.length);
    if (cost === null) drawText(g, 'MAX', r.x + r.w - 5, r.y + 22, C.green, { align: 'right' });
    else {
      drawText(g, String(cost), r.x + r.w - 5, r.y + 22, afford ? C.gold : C.gray, { align: 'right' });
      drawCoin(g, r.x + r.w - 12 - String(cost).length * 4, r.y + 21);
    }
  },
  pick(id, ctx, s) {
    if (upgradeCost(ctx.save, id) === null) { s.say('ALREADY MAX!', C.green); sfx.click(); }
    else if (buyUpgrade(ctx.save, id)) { ctx.persist(); sfx.buy(); s.say(`BOUGHT ${UPGRADES[id].name}!`, C.green); }
    else { sfx.creak(); s.say('NOT ENOUGH COINS', C.orange); }
  },
});

export const charScreen = makeList({
  title: 'CHOOSE YOUR KID',
  items: CHAR_ORDER,
  rowH: 56,
  drawRow(g, id, r, { save }) {
    const c = CHARACTERS[id], own = owns(save, id), cur = save.char === id;
    g.fillStyle = C.ink; g.fillRect(r.x + 3, r.y + 5, 28, 28);
    if (!drawPortrait(g, c.look, r.x + 3, r.y + 5)) drawActor(g, c.look, r.x + 16, r.y + 30, 0, 0);
    if (!own) { g.globalAlpha = 0.55; g.fillStyle = C.ink; g.fillRect(r.x + 3, r.y + 5, 28, 28); g.globalAlpha = 1; }
    drawText(g, c.name, r.x + 34, r.y + 6, C.white);
    if (cur) drawText(g, 'SELECTED', r.x + r.w - 5, r.y + 6, C.green, { align: 'right' });
    else if (own) drawText(g, 'TAP TO PICK', r.x + r.w - 5, r.y + 6, C.gray, { align: 'right' });
    else {
      drawText(g, String(c.cost), r.x + r.w - 5, r.y + 6, save.bank >= c.cost ? C.gold : C.gray, { align: 'right' });
      drawCoin(g, r.x + r.w - 12 - String(c.cost).length * 4, r.y + 5);
    }
    drawText(g, c.lines[0], r.x + 34, r.y + 20, C.yellow);
    drawText(g, c.lines[1], r.x + 34, r.y + 32, C.gray);
    drawText(g, `SKILL: ${c.skill.label}  COOLDOWN ${c.skill.cd}S`, r.x + 34, r.y + 42, C.gray);
  },
  pick(id, ctx, s) {
    const res = pickChar(ctx.save, id);
    if (res === 'poor') { sfx.creak(); s.say('NOT ENOUGH COINS', C.orange); return; }
    ctx.persist();
    if (res === 'bought') { sfx.buy(); s.say(`${CHARACTERS[id].name} UNLOCKED!`, C.green); } else { sfx.click(); s.say(`PLAYING AS ${CHARACTERS[id].name}`, C.white); }
  },
});
