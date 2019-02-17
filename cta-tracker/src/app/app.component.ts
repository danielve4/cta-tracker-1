import { Component } from '@angular/core';
import { Router, Event, NavigationEnd } from '@angular/router';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  LS_SAVED_ROUTE: string = 'LS_SAVED_ROUTE';
  firstLoad: boolean = true;
  constructor(private router: Router) {
    const savedCurrentRoute: string = localStorage.getItem(this.LS_SAVED_ROUTE);

    if (this.firstLoad && savedCurrentRoute)
      this.router.navigateByUrl(savedCurrentRoute);

    this.firstLoad = false;

    router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd)
        localStorage.setItem(this.LS_SAVED_ROUTE, event.url);

    });
  }
}
