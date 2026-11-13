// IBALIK (design overhaul Blueprint 7.2, L11): Jun puts back what he took too much of. DOM-free (tests/levelpass).
//
// - The amount J is the sobra from the first clears of the levels before IBALIK, clamped to 5..12.
// - It comes out of the bank. If the bank holds less, Jun breaks his own alkansya for the rest (a story line says
//   so); the bank never goes negative.
// - It is split across Mama, Lola and Tita by what the ledger says was taken from each (Tatay's and the house's
//   coins go back into Mama's purse), at least one coin each.
export const MIN = 5, MAX = 12;
export const OWNERS = ['mama', 'lola', 'tita'];
const FOLD = { tatay: 'mama', bahay: 'mama' };

// ledger: save.ledger; before: the level ids that come before IBALIK; bank: save.bank
export function returnPlan(ledger = {}, before = [], bank = 0) {
  let sobra = 0;
  const took = { mama: 0, lola: 0, tita: 0 };
  for (const id of before) {
    const e = ledger[id];
    if (!e) continue;
    sobra += e.sobra | 0;
    for (const [who, n] of Object.entries(e.by || {})) { const k = FOLD[who] || who; if (k in took) took[k] += n | 0; }
  }
  const J = Math.max(MIN, Math.min(MAX, sobra));
  const fromBank = Math.max(0, Math.min(J, Math.floor(bank) || 0));
  // one each, then the rest by share (largest remainder; ties go Mama, Lola, Tita)
  const split = { mama: 1, lola: 1, tita: 1 }, rest = J - 3, total = took.mama + took.lola + took.tita;
  const share = OWNERS.map((k) => (total ? (took[k] / total) * rest : rest / 3));
  OWNERS.forEach((k, i) => { split[k] += Math.floor(share[i]); });
  let left = J - OWNERS.reduce((s, k) => s + split[k], 0);
  for (const i of OWNERS.map((_, i) => i).sort((a, b) => (share[b] % 1) - (share[a] % 1) || a - b)) { if (left <= 0) break; split[OWNERS[i]]++; left--; }
  return { J, fromBank, fromAlkansya: J - fromBank, split };
}

// The level as this plan makes it: each owner's stash holds their share, the quota is J.
export function applyReturn(L, plan) {
  if (!L.giveBack) return L;
  const out = { ...L, quota: plan.J, targets: L.targets.map((t) => (t.kind === 'ibalik' && plan.split[t.owner] !== undefined ? { ...t, coins: plan.split[t.owner] } : t)) };
  out.hint = plan.fromAlkansya > 0 ? `PUT BACK ${plan.J}: ${plan.fromAlkansya} FROM JUN'S OWN ALKANSYA` : `PUT BACK ALL ${plan.J}. QUIETLY: FULL POCKETS JINGLE`;
  out.returnPlan = plan;
  return out;
}
