import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule }    from '@angular/common/http';

import { AppComponent } from './app.component';
import { ArrivalsComponent } from './arrivals/arrivals.component';
import { FavoritesComponent } from './favorites/favorites.component';
import { RoutesComponent } from './routes/routes.component';
import { StopsComponent } from './stops/stops.component';
import { DirectionsComponent } from './directions/directions.component';
import { FollowVehicleComponent } from './follow-vehicle/follow-vehicle.component';
import { AppRoutingModule } from './/app-routing.module';
import { TimeuntilPipe } from './timeuntil.pipe';

@NgModule({
  declarations: [
    AppComponent,
    ArrivalsComponent,
    FavoritesComponent,
    RoutesComponent,
    StopsComponent,
    DirectionsComponent,
    FollowVehicleComponent,
    TimeuntilPipe
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
