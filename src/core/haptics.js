// Phone vibration. Silently does nothing where unsupported (iOS Safari, desktops); the game shows a
// visual pulse instead there (see canVibrate and the "visual pulse" option).
let enabled = true;

export const setHaptics = (on) => { enabled = !!on; };
export const hapticsOn = () => enabled;
export const canVibrate = () => { try { return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'; } catch { return false; } };

// Returns true if the phone actually buzzed.
export function vibrate(pattern) {
  if (!enabled) return false;
  try { if (navigator.vibrate) { navigator.vibrate(pattern); return true; } } catch { /* ignore */ }
  return false;
}
