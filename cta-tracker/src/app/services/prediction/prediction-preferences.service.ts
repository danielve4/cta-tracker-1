import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SuggestionMode, parseSuggestionMode } from './auto-open';
import { SafeStorage, browserStorage, nullStorage } from './safe-storage';

export const COLLECT_STOP_HISTORY_KEY = 'predict-collect-history';
export const USE_LOCATION_KEY = 'predict-use-location';
export const SUGGESTION_MODE_KEY = 'predict-suggestion-mode';
export const DID_YOU_MEAN_KEY = 'predict-did-you-mean';

/**
 * Toggles for the prediction feature, mirroring DisplayPreferencesService.
 *
 * The two defaults differ on purpose. History collection defaults on: it is a few hundred rows of
 * which-stop-when that never leave the device, and a suggestion feature that collects nothing until
 * the user finds a settings screen would never have data to work with. Location defaults off and
 * stays off until the user turns it on, because enabling it is what fires the browser permission
 * prompt — an unexplained prompt is worse than a slightly weaker model.
 *
 * The suggestion mode defaults to the chip, since opening a stop unasked is a behaviour to opt into.
 * "Did you mean" defaults on: it only ever speaks on a cold start, and only about a stop that looks
 * out of place, so it stays quiet for anyone without a routine for it to recognise.
 */
@Injectable({ providedIn: 'root' })
export class PredictionPreferencesService {
  // Must be initialized before the signals below, which read from it. Goes through SafeStorage
  // because these are field initializers: a raw localStorage throw here fails DI for every
  // consumer, which would stop the arrivals components rendering at all.
  private readonly storage: SafeStorage =
    isPlatformBrowser(inject(PLATFORM_ID)) ? browserStorage() : nullStorage();

  readonly collectHistory = signal<boolean>(this.load(COLLECT_STOP_HISTORY_KEY, true));
  readonly useLocation = signal<boolean>(this.load(USE_LOCATION_KEY, false));
  readonly suggestionMode = signal<SuggestionMode>(parseSuggestionMode(this.storage.get(SUGGESTION_MODE_KEY)));
  readonly didYouMean = signal<boolean>(this.load(DID_YOU_MEAN_KEY, true));

  setCollectHistory(enabled: boolean): void {
    this.collectHistory.set(enabled);
    this.store(COLLECT_STOP_HISTORY_KEY, enabled);
  }

  setUseLocation(enabled: boolean): void {
    this.useLocation.set(enabled);
    this.store(USE_LOCATION_KEY, enabled);
  }

  setSuggestionMode(mode: SuggestionMode): void {
    this.suggestionMode.set(mode);
    this.storage.set(SUGGESTION_MODE_KEY, mode);
  }

  setDidYouMean(enabled: boolean): void {
    this.didYouMean.set(enabled);
    this.store(DID_YOU_MEAN_KEY, enabled);
  }

  private store(key: string, value: boolean): void {
    this.storage.set(key, String(value));
  }

  private load(key: string, fallback: boolean): boolean {
    const stored = this.storage.get(key);
    return stored === null ? fallback : stored === 'true';
  }
}
