// Angular wrapper around SessionState. All the logic — and all the tests — live in session-state.ts.

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { browserStorage, nullStorage } from './safe-storage';
import { SessionState } from './session-state';

export {
  COLD_START_GAP_MS, LAST_ACTIVITY_KEY, SESSION_GAP_MS, SESSION_KEY
} from './session-state';

@Injectable({ providedIn: 'root' })
export class SessionService extends SessionState {
  constructor() {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    super(isBrowser ? browserStorage() : nullStorage());
  }
}
