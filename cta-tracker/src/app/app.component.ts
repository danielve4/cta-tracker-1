import { Component, ChangeDetectionStrategy, inject, afterNextRender, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, Event, NavigationEnd, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { DidYouMeanComponent } from './did-you-mean/did-you-mean.component';
import { EntrySource } from './services/prediction/stop-view-event';
import { PredictorService, Suggestion } from './services/prediction/predictor.service';
import { stopViewUrl } from './services/prediction/stop-key';
import { SessionService } from './services/prediction/session.service';
import { StopViewTrackerService } from './services/prediction/stop-view-tracker.service';
import { EventLogStore } from './services/prediction/event-log.store';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DidYouMeanComponent]
})
export class AppComponent {
  /**
   * How long a cold launch waits for the ranking before giving up on auto-open and restoring as
   * usual. The ranking is a few IndexedDB reads, well inside this; the bound is for a device where
   * they are not, since the prerendered Routes screen is what the user sees while it waits.
   */
  private readonly AUTO_OPEN_WAIT_MS = 500;

  private readonly LS_SAVED_ROUTE = 'LS_SAVED_ROUTE';
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly session = inject(SessionService);
  private readonly tracker = inject(StopViewTrackerService);
  private readonly predictor = inject(PredictorService);
  private readonly eventLog = inject(EventLogStore);

  constructor() {
    // Restore the last visited route, but only when the document was launched from the
    // start URL ('/') so an intentional deep-link to /favorites or /settings isn't
    // overridden. Runs in afterNextRender → browser-only and after the first (hydration)
    // render. Use location.pathname (the real launch URL) rather than router.url, which
    // may not have resolved the initial navigation yet at this point.
    afterNextRender(() => {
      this.session.start();
      this.tracker.start();
      void this.eventLog.prune();

      if (location.pathname === '/') {
        // Armed synchronously, before anything can mount the suggestion chip, so the chip is held
        // back while this decides whether to leave the screen it would appear on.
        this.predictor.armAutoOpen();
        void this.autoOpenTarget().then(target => {
          if (target) {
            // Tagged 'auto' for the same reason as 'restored' below: the model chose this stop, and
            // training on it would teach the model its own guess.
            this.router.navigateByUrl(stopViewUrl(target.event), { state: { entry: 'auto' satisfies EntrySource } });
            return;
          }
          const saved = localStorage.getItem(this.LS_SAVED_ROUTE);
          // Tagged 'restored': this navigation is the app's doing, not the user's. Untagged it would
          // look like a deliberate deep-link and would inject a stop the user never chose as the
          // session's first view — exactly the label the predictor is trained on.
          this.router.navigateByUrl(saved && saved !== '/' ? saved : '/routes',
            { state: { entry: 'restored' satisfies EntrySource } });
        });
      }
    });

    this.router.events.pipe(takeUntilDestroyed()).subscribe((event: Event) => {
      if (event instanceof NavigationEnd && this.isBrowser) {
        localStorage.setItem(this.LS_SAVED_ROUTE, event.url);

        // Read before the navigation settles — getCurrentNavigation() is null once it has.
        const stateEntry = this.entryFromState();
        const navigationToken = this.predictor.noteNavigation();
        // Caught rather than left floating: this is telemetry, and an unhandled rejection here
        // would take the impression-resolution step down with it.
        void this.tracker.handleNavigation(event, stateEntry)
          .then((view) => {
            if (view) {
              // Closes out an open shadow impression with where the user actually went, and checks
              // whether the stop looks like one they meant to open.
              return this.predictor.onStopView(view, navigationToken);
            }
            return undefined;
          })
          .catch(() => undefined);
      }
    });
  }

  /**
   * Whichever comes first, the ranking or the timeout. `claimAutoOpen` and `disarmAutoOpen` agree on
   * a single winner, so a ranking that lands after the timeout can never redirect a launch that has
   * already restored.
   */
  private async autoOpenTarget(): Promise<Suggestion | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>(resolve => {
      timer = setTimeout(() => {
        this.predictor.disarmAutoOpen();
        resolve(null);
      }, this.AUTO_OPEN_WAIT_MS);
    });
    try {
      return await Promise.race([this.predictor.claimAutoOpen(), timeout]);
    } catch {
      this.predictor.disarmAutoOpen();
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private entryFromState(): EntrySource | null {
    const entry = this.router.getCurrentNavigation()?.extras.state?.['entry'];
    return typeof entry === 'string' ? entry as EntrySource : null;
  }
}
