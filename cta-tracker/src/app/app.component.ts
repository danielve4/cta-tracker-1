import { Component, ChangeDetectionStrategy, inject, afterNextRender, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, Event, NavigationEnd, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { EntrySource } from './services/prediction/stop-view-event';
import { PredictorService } from './services/prediction/predictor.service';
import { SessionService } from './services/prediction/session.service';
import { StopViewTrackerService } from './services/prediction/stop-view-tracker.service';
import { EventLogStore } from './services/prediction/event-log.store';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive]
})
export class AppComponent {
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
        const saved = localStorage.getItem(this.LS_SAVED_ROUTE);
        // Tagged 'restored': this navigation is the app's doing, not the user's. Untagged it would
        // look like a deliberate deep-link and would inject a stop the user never chose as the
        // session's first view — exactly the label the predictor is trained on.
        this.router.navigateByUrl(saved && saved !== '/' ? saved : '/routes',
          { state: { entry: 'restored' satisfies EntrySource } });
      }
    });

    this.router.events.pipe(takeUntilDestroyed()).subscribe((event: Event) => {
      if (event instanceof NavigationEnd && this.isBrowser) {
        localStorage.setItem(this.LS_SAVED_ROUTE, event.url);

        // Read before the navigation settles — getCurrentNavigation() is null once it has.
        const stateEntry = this.entryFromState();
        void this.tracker.handleNavigation(event, stateEntry).then((stopKey) => {
          if (stopKey) {
            // Closes out an open shadow impression with where the user actually went.
            void this.predictor.resolveWith(stopKey);
          }
        });
      }
    });
  }

  private entryFromState(): EntrySource | null {
    const entry = this.router.getCurrentNavigation()?.extras.state?.['entry'];
    return typeof entry === 'string' ? entry as EntrySource : null;
  }
}
