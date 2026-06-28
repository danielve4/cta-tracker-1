import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
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

  constructor() {
    const savedCurrentRoute = localStorage.getItem(this.LS_SAVED_ROUTE);

    if (savedCurrentRoute) {
      this.router.navigateByUrl(savedCurrentRoute);
    }

    this.router.events.pipe(takeUntilDestroyed()).subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        localStorage.setItem(this.LS_SAVED_ROUTE, event.url);
      }
    });
  }
}
