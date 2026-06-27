import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Router, Event, NavigationEnd, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterOutlet, RouterLink, RouterLinkActive]
})
export class AppComponent {
  private readonly LS_SAVED_ROUTE = 'LS_SAVED_ROUTE';

  constructor(private router: Router) {
    const savedCurrentRoute = localStorage.getItem(this.LS_SAVED_ROUTE);

    if (savedCurrentRoute) {
      this.router.navigateByUrl(savedCurrentRoute);
    }

    router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        localStorage.setItem(this.LS_SAVED_ROUTE, event.url);
      }
    });
  }
}
