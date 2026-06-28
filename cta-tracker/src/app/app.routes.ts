import { Routes } from '@angular/router';

import { RoutesComponent } from './routes/routes.component';

export const routes: Routes = [
  { path: '', component: RoutesComponent },
  { path: 'routes', component: RoutesComponent },
  {
    path: 'directions/:route',
    loadComponent: () => import('./directions/directions.component').then(m => m.DirectionsComponent)
  },
  {
    path: 'stops/:route/:direction',
    loadComponent: () => import('./stops/stops.component').then(m => m.StopsComponent)
  },
  {
    path: 'arrivals/:route/:direction/:stopId/:stopName',
    loadComponent: () => import('./arrivals/arrivals.component').then(m => m.ArrivalsComponent)
  },
  {
    path: 'follow/:vehicleId',
    loadComponent: () => import('./follow-vehicle/follow-vehicle.component').then(m => m.FollowVehicleComponent)
  },
  {
    path: 'favorites',
    loadComponent: () => import('./favorites/favorites.component').then(m => m.FavoritesComponent)
  },
  {
    path: 'train-stops/:routeId',
    loadComponent: () => import('./train-stops/train-stops.component').then(m => m.TrainStopsComponent)
  },
  {
    path: 'train-arrivals/:routeId/:stationId/:stationName',
    loadComponent: () => import('./train-arrivals/train-arrivals.component').then(m => m.TrainArrivalsComponent)
  },
  {
    path: 'train-follow/:runNumber',
    loadComponent: () => import('./train-follow/train-follow.component').then(m => m.TrainFollowComponent)
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent)
  },
  { path: '**', redirectTo: '/routes' }
];
