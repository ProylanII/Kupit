// Chiptune tracks as data. DOM-free so tests can check them.
// A track loops `steps` 16th-notes; each voice lists a MIDI note per step (0 = rest).
// len = how many steps a note rings for.
const loop = (arr, times) => Array.from({ length: times }, () => arr).flat();

export const TRACKS = {
  // Title / menus: bouncy C major.
  menu: {
    bpm: 112, steps: 32,
    voices: [
      { wave: 'square', vol: 0.16, len: 1.6, notes: [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 77, 0, 81, 0, 77, 0, 72, 0, 76, 0, 79, 0, 84, 0, 83, 0, 79, 0, 76, 0, 74, 0] },
      { wave: 'triangle', vol: 0.3, len: 3, notes: [48, 0, 0, 0, 48, 0, 0, 0, 53, 0, 0, 0, 53, 0, 0, 0, 55, 0, 0, 0, 55, 0, 0, 0, 43, 0, 0, 0, 43, 0, 0, 0] },
      { wave: 'square', vol: 0.07, len: 1, notes: loop([0, 0, 64, 0, 0, 0, 67, 0], 4) },
    ],
  },
  // In a level: slow, sparse A minor. Quiet so the sound effects (footsteps, creaks) still matter.
  sneak: {
    bpm: 84, steps: 32,
    voices: [
      { wave: 'triangle', vol: 0.32, len: 3, notes: [45, 0, 0, 0, 0, 0, 45, 0, 0, 0, 0, 0, 48, 0, 0, 0, 43, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 47, 0, 0, 0] },
      { wave: 'square', vol: 0.09, len: 2, notes: [0, 0, 0, 0, 69, 0, 0, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0, 0, 0, 67, 0, 0, 0, 0, 0, 71, 0, 0, 0, 0, 0] },
      { wave: 'triangle', vol: 0.1, len: 6, notes: [0, 0, 0, 0, 0, 0, 0, 0, 57, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 55, 0, 0, 0, 0, 0, 0, 0] },
    ],
  },
  // Someone is chasing you: fast, driving E minor.
  chase: {
    bpm: 152, steps: 32,
    voices: [
      { wave: 'sawtooth', vol: 0.11, len: 1, notes: [40, 40, 0, 40, 40, 0, 43, 0, 40, 40, 0, 40, 38, 0, 36, 0, 40, 40, 0, 40, 40, 0, 43, 0, 45, 45, 0, 45, 43, 0, 41, 0] },
      { wave: 'square', vol: 0.11, len: 1.2, notes: [76, 79, 83, 79, 76, 79, 83, 79, 74, 78, 81, 78, 74, 78, 81, 78, 76, 79, 83, 79, 76, 79, 83, 79, 81, 84, 88, 84, 79, 83, 86, 83] },
    ],
  },
  // Boss fights: heavy D minor with a pulsing bass.
  boss: {
    bpm: 124, steps: 32,
    voices: [
      { wave: 'sawtooth', vol: 0.12, len: 1.4, notes: [38, 0, 38, 0, 38, 0, 41, 0, 38, 0, 38, 0, 36, 0, 34, 0, 38, 0, 38, 0, 38, 0, 41, 0, 43, 0, 41, 0, 38, 0, 36, 0] },
      { wave: 'triangle', vol: 0.2, len: 1.5, notes: [62, 65, 69, 65, 62, 65, 69, 65, 60, 64, 67, 64, 60, 64, 67, 64, 62, 65, 69, 65, 62, 65, 69, 65, 58, 62, 65, 62, 57, 61, 64, 61] },
      { wave: 'square', vol: 0.08, len: 3, notes: [0, 0, 0, 0, 74, 0, 0, 0, 0, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0, 77, 0, 0, 0, 0, 0, 0, 0, 76, 0, 0, 0] },
    ],
  },
};

export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

// Notes to play on a given step: [{ hz, wave, vol, len }]
export function stepNotes(track, step) {
  const out = [];
  for (const v of track.voices) {
    const m = v.notes[step % track.steps];
    if (m) out.push({ hz: midiHz(m), wave: v.wave, vol: v.vol, len: v.len });
  }
  return out;
}
