// localStorage that cannot take the app down with it.
//
// The app deliberately fills localStorage with large CTA payloads ('traindata', one entry per
// route/direction stop list), so QuotaExceededError on a write is a live scenario rather than a
// theoretical one, and any access throws SecurityError where site data is blocked. Prediction is
// telemetry: the worst acceptable outcome of it failing is that no telemetry is collected, never a
// broken navigation or a lost user-facing feature.

export interface SafeStorage {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
}

/** Every operation swallows; a failed read is indistinguishable from an absent key by design. */
export function browserStorage(): SafeStorage {
  return {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }
  };
}

/** For the server platform, where there is no storage and nothing should pretend otherwise. */
export function nullStorage(): SafeStorage {
  return { get: () => null, set: () => false };
}
