import { Routes } from '@angular/router';

import { ArrivalsComponent } from './arrivals/arrivals.component';
import { DirectionsComponent } from './directions/directions.component';
import { FavoritesComponent } from './favorites/favorites.component';
import { FollowVehicleComponent } from './follow-vehicle/follow-vehicle.component';
import { RoutesComponent } from './routes/routes.component';
import { StopsComponent } from './stops/stops.component';
import { TrainStopsComponent } from './train-stops/train-stops.component';
import { TrainArrivalsComponent } from './train-arrivals/train-arrivals.component';
import { TrainFollowComponent } from './train-follow/train-follow.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
  { path: '', redirectTo: '/routes', pathMatch: 'full' },
  { path: 'routes', component: RoutesComponent },
  { path: 'directions/:route', component: DirectionsComponent },
  { path: 'stops/:route/:direction', component: StopsComponent },
  { path: 'arrivals/:route/:direction/:stopId/:stopName', component: ArrivalsComponent },
  { path: 'follow/:vehicleId', component: FollowVehicleComponent },
  { path: 'favorites', component: FavoritesComponent },
  { path: 'train-stops/:routeId', component: TrainStopsComponent },
  { path: 'train-arrivals/:routeId/:stationId/:stationName', component: TrainArrivalsComponent },
  { path: 'train-follow/:runNumber', component: TrainFollowComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: '/routes' }
];
