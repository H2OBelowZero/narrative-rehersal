// Remembered layout choices for writing with focus: whether the nav sidebar and the script panel are folded away.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export interface FocusPrefs {
  /** Wide screens: the string-nav sidebar folded to a rail of pins. */
  navCollapsed: boolean;
  /** Script editor: the revisions / changes / notes panel hidden. */
  panelCollapsed: boolean;
}

const KEY = 'nr.focusPrefs';
let prefs: FocusPrefs = { navCollapsed: false, panelCollapsed: false };
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((saved) => {
    if (saved) set(JSON.parse(saved) as Partial<FocusPrefs>, false);
  })
  .catch(() => {});

function set(patch: Partial<FocusPrefs>, persist = true) {
  prefs = { ...prefs, ...patch };
  for (const l of listeners) l();
  if (persist) AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {});
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useFocusPrefs(): FocusPrefs & { setFocusPrefs: (patch: Partial<FocusPrefs>) => void } {
  const current = useSyncExternalStore(subscribe, () => prefs, () => prefs);
  return { ...current, setFocusPrefs: set };
}
