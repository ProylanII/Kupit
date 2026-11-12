// Sari-sari store (permanent upgrades), cosmetics (outfits + title decor) and character select.
import { drawText } from '../ui/font.js';
import { drawButton, buttonRect, hit } from '../ui/menu.js';
import { drawCoin, drawActor, drawPortrait, drawStar } from '../render/sprites.js';
import { C } from '../render/palette.js';
import { VIEW_W } from '../core/input.js';
import { sfx } from '../core/audio.js';
import {
  NEEDS, NEED_ORDER, hasNeed, needCost, buyNeed,
  UPGRADES, UPGRADE_ORDER, CHARACTERS, CHAR_ORDER, OUTFITS, OUTFIT_ORDER, DECOR, DECOR_ORDER,
  upgradeCost, buyUpgrade, pickChar, owns, upgradeStat, buyCosmetic, totalStars,
} from '../game/progression.js';
import { MUTATORS } from '../game/house.js';

const ROW_Y = 44;
const rowRect = (i, rowH) => ({ x: 10, y: ROW_Y + i * rowH, w: VIEW_W - 20, h: rowH - 4 });
const backRect = () => buttonRect(0, 332, 22, 100);

// ctx = { save, persist(), back(), go(mode) }
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
      if (s.msg) drawText(g, s.msg.text, VIEW_W / 2, 323, s.msg.color, { align: 'center' });
      drawButton(g, backRect(), 'BACK', s.sel === items.length);
    },
  };
  return s;
}

function pips(g, x, y, have, max) {
  for (let i = 0; i < max; i++) { g.fillStyle = C.ink; g.fillRect(x + i * 11, y, 9, 7); g.fillStyle = i < have ? C.gold : C.dgray; g.fillRect(x + i * 11 + 1, y + 1, 7, 5); }
}

function price(g, cost, x, y, afford) {
  drawText(g, String(cost), x, y, afford ? C.gold : C.gray, { align: 'right' });
  drawCoin(g, x - 7 - String(cost).length * 4, y - 1);
}

// Aling Nena's: what Mingming and the kittens need comes first; gear and looks are one tap further in.
export const shopScreen = makeList({
  title: "ALING NENA'S STORE",
  items: [...NEED_ORDER, 'gear', 'more'],
  rowH: 38,
  drawRow(g, id, r, { save }) {
    if (id === 'gear' || id === 'more') {
      drawText(g, id === 'gear' ? 'SNEAKING GEAR  >' : 'OUTFITS + DECOR  >', r.x + r.w / 2, r.y + 8, C.white, { align: 'center' });
      drawText(g, id === 'gear' ? 'QUIET TSINELAS, QUICK HANDS, POCKETS...' : 'LOOKS ONLY: THEY NEVER CHANGE THE GAME', r.x + r.w / 2, r.y + 20, C.gray, { align: 'center' });
      return;
    }
    const n = NEEDS[id], own = hasNeed(save, id), cost = needCost(save, id);
    drawText(g, n.name, r.x + 6, r.y + 4, own ? C.pink : C.white);
    drawText(g, own ? n.got : n.desc, r.x + 6, r.y + 14, own ? C.green : C.gray);
    if (own) drawText(g, 'GIVEN', r.x + r.w - 5, r.y + 4, C.green, { align: 'right' });
    else {
      price(g, cost, r.x + r.w - 5, r.y + 4, save.bank >= cost);
      drawText(g, save.story.nena ? `SUKI PRICE (WAS ${n.cost})` : 'FOR MINGMING AND THE KITTENS', r.x + 6, r.y + 24, save.story.nena ? C.yellow : C.dgray);
    }
  },
  pick(id, ctx, s) {
    if (id === 'gear') { ctx.go('upgrades'); return; }
    if (id === 'more') { ctx.go('cosmetics'); return; }
    const res = buyNeed(ctx.save, id);
    if (res === 'bought') { ctx.persist(); sfx.buy(); s.say(NEEDS[id].got, C.green); }
    else if (res === 'owned') { sfx.click(); s.say('THEY ALREADY HAVE IT', C.green); }
    else { sfx.creak(); s.say('NOT ENOUGH COINS', C.orange); }
  },
});

export const upgradesScreen = makeList({
  title: 'SNEAKING GEAR',
  items: [...UPGRADE_ORDER],
  rowH: 40,
  drawRow(g, id, r, { save }) {
    if (id === 'more') {
      drawText(g, 'OUTFITS + DECOR  >', r.x + r.w / 2, r.y + 10, C.white, { align: 'center' });
      drawText(g, 'LOOKS ONLY: THEY NEVER CHANGE THE GAME', r.x + r.w / 2, r.y + 22, C.gray, { align: 'center' });
      return;
    }
    const u = UPGRADES[id], have = save.upgrades[id] | 0, cost = upgradeCost(save, id);
    drawText(g, u.name, r.x + 6, r.y + 4, C.white);
    drawText(g, u.desc, r.x + 6, r.y + 13, C.gray);
    pips(g, r.x + r.w - 38, r.y + 3, have, u.costs.length);
    // stat bar: what it does for the kid you're playing now, and after the next level
    const st = upgradeStat(save, id);
    drawText(g, `${st.label} ${st.now}${st.next !== null ? ` > ${st.next}` : ''}`, r.x + 6, r.y + 25, st.next !== null ? C.yellow : C.green);
    g.fillStyle = C.ink; g.fillRect(r.x + 112, r.y + 25, 52, 5);
    g.fillStyle = C.teal; g.fillRect(r.x + 113, r.y + 26, Math.round(50 * st.frac), 3);
    if (cost === null) drawText(g, 'MAX', r.x + r.w - 5, r.y + 24, C.green, { align: 'right' });
    else price(g, cost, r.x + r.w - 5, r.y + 24, save.bank >= cost);
  },
  pick(id, ctx, s) {
    if (id === 'more') { ctx.go('cosmetics'); return; }
    if (upgradeCost(ctx.save, id) === null) { s.say('ALREADY MAX!', C.green); sfx.click(); }
    else if (buyUpgrade(ctx.save, id)) { ctx.persist(); sfx.buy(); s.say(`BOUGHT ${UPGRADES[id].name}!`, C.green); }
    else { sfx.creak(); s.say('NOT ENOUGH COINS', C.orange); }
  },
});

// How a locked cosmetic is earned, in a few words.
function howText(how) {
  if (how.stars) return `${how.stars} STARS`;
  if (how.mutator) return `${MUTATORS[how.mutator].name} LV3+`;
  if (how.pasko) return 'PASKO SEASON';
  return '';
}

export const cosmeticsScreen = makeList({
  title: 'OUTFITS + DECOR',
  items: [...OUTFIT_ORDER.map((id) => `o:${id}`), ...DECOR_ORDER.map((id) => `d:${id}`)],
  rowH: 18,
  drawRow(g, key, r, { save }) {
    const [k, id] = key.split(':'), outfit = k === 'o', def = outfit ? OUTFITS[id] : DECOR[id];
    const own = outfit ? save.outfits.includes(id) : save.decor.includes(id);
    if (outfit) { // swatch: top + bottom colours
      const t = def.top || ['#ffd84d'], b = def.bottom || def.top || ['#2f5fbf'];
      g.fillStyle = C.ink; g.fillRect(r.x + 3, r.y + 2, 10, 11);
      g.fillStyle = t[0]; g.fillRect(r.x + 4, r.y + 3, 8, 5);
      g.fillStyle = b[0]; g.fillRect(r.x + 4, r.y + 8, 8, 4);
    } else drawStar(g, r.x + 5, r.y + 5, own);
    drawText(g, def.name, r.x + 18, r.y + 5, own ? C.white : C.gray);
    let right, col = C.gray;
    if (outfit && save.outfit === id) { right = 'WEARING'; col = C.green; }
    else if (own) { right = outfit ? 'TAP TO WEAR' : save.decorOff.includes(id) ? 'OFF' : 'ON'; col = outfit ? C.gray : save.decorOff.includes(id) ? C.gray : C.green; }
    else if (def.how.cost !== undefined) { price(g, def.how.cost, r.x + r.w - 4, r.y + 5, save.bank >= def.how.cost); return; }
    else right = howText(def.how);
    drawText(g, right, r.x + r.w - 4, r.y + 5, col, { align: 'right' });
  },
  pick(key, ctx, s) {
    const [k, id] = key.split(':'), save = ctx.save, outfit = k === 'o', def = outfit ? OUTFITS[id] : DECOR[id];
    const own = outfit ? save.outfits.includes(id) : save.decor.includes(id);
    if (own) {
      if (outfit) { save.outfit = id; s.say(`WEARING ${def.name}`, C.white); }
      else {
        const off = save.decorOff.includes(id);
        save.decorOff = off ? save.decorOff.filter((x) => x !== id) : [...save.decorOff, id];
        s.say(`${def.name}: ${off ? 'ON' : 'OFF'}`, C.white);
      }
      ctx.persist(); sfx.click(); return;
    }
    const res = buyCosmetic(save, outfit ? 'outfit' : 'decor', id);
    if (res === 'bought') { if (outfit) save.outfit = id; ctx.persist(); sfx.buy(); s.say(`GOT ${def.name}!`, C.green); }
    else if (res === 'poor') { sfx.creak(); s.say('NOT ENOUGH COINS', C.orange); }
    else { sfx.creak(); s.say(`UNLOCK: ${howText(def.how)} (YOU HAVE ${totalStars(save)} STARS)`, C.orange); }
  },
});

export const charScreen = makeList({
  title: 'THE CREW',
  items: CHAR_ORDER,
  rowH: 56,
  drawRow(g, id, r, { save }) {
    const c = CHARACTERS[id], own = owns(save, id), cur = save.char === id;
    const look = save.outfit && save.outfit !== 'basic' ? `${c.look}~${save.outfit}` : c.look;
    g.fillStyle = C.ink; g.fillRect(r.x + 3, r.y + 5, 28, 28);
    if (!drawPortrait(g, look, r.x + 3, r.y + 5)) drawActor(g, look, r.x + 16, r.y + 30, 0, 0);
    if (!own) { g.globalAlpha = 0.55; g.fillStyle = C.ink; g.fillRect(r.x + 3, r.y + 5, 28, 28); g.globalAlpha = 1; }
    drawText(g, c.name, r.x + 34, r.y + 6, C.white);
    if (cur) drawText(g, 'SELECTED', r.x + r.w - 5, r.y + 6, C.green, { align: 'right' });
    else if (own) drawText(g, 'TAP TO PICK', r.x + r.w - 5, r.y + 6, C.gray, { align: 'right' });
    else drawText(g, 'JOINS IN THE STORY', r.x + r.w - 5, r.y + 6, C.dgray, { align: 'right' });
    drawText(g, c.lines[0], r.x + 34, r.y + 20, C.yellow);
    drawText(g, c.lines[1], r.x + 34, r.y + 32, C.gray);
    drawText(g, `SKILL: ${c.skill.label}  COOLDOWN ${c.skill.cd}S`, r.x + 34, r.y + 42, C.gray);
  },
  pick(id, ctx, s) {
    const res = pickChar(ctx.save, id);
    if (res === 'locked') { sfx.creak(); s.say(`${CHARACTERS[id].name} DOES NOT KNOW THE SECRET YET`, C.orange); return; }
    ctx.persist();
    sfx.click(); s.say(`PLAYING AS ${CHARACTERS[id].name}`, C.white);
  },
});
