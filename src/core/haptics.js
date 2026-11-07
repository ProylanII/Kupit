// Phone vibration. Silently does nothing where unsupported (iOS Safari, desktops).
let enabled = true;

export const setHaptics = (on) => { enabled = !!on; };
export const hapticsOn = () => enabled;

export function vibrate(pattern) {
  if (!enabled) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* ignore */ }
}
