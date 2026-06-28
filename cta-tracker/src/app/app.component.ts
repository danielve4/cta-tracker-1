import { Component, ChangeDetectionStrategy, inject, afterNextRender, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, Event, NavigationEnd, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

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

  constructor() {
    // Restore the last visited route, but only when the document was launched from the
    // start URL ('/') so an intentional deep-link to /favorites or /settings isn't
    // overridden. Runs in afterNextRender → browser-only and after the first (hydration)
    // render. Use location.pathname (the real launch URL) rather than router.url, which
    // may not have resolved the initial navigation yet at this point.
    afterNextRender(() => {
      if (location.pathname === '/') {
        const saved = localStorage.getItem(this.LS_SAVED_ROUTE);
        this.router.navigateByUrl(saved && saved !== '/' ? saved : '/routes');
      }
    });

    this.router.events.pipe(takeUntilDestroyed()).subscribe((event: Event) => {
      if (event instanceof NavigationEnd && this.isBrowser) {
        localStorage.setItem(this.LS_SAVED_ROUTE, event.url);
      }
    });
  }
}
