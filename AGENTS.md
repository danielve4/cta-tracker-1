# CTA Tracker Project Guide

## Project overview
CTA Tracker is an Angular single-page application for browsing Chicago Transit Authority bus routes, directions, stops, and predicted arrivals. It also supports favoriting stops and following active vehicles.

## Stack
- **Language:** TypeScript, HTML, CSS
- **Framework:** Angular (NgModule-based app with router-driven views)
- **Build tooling:** Angular CLI with `@angular/build`
- **Runtime platform:** Node.js 24.x (recommended for local development)
- **Reactive programming:** RxJS
- **PWA support:** Angular Service Worker (`@angular/service-worker`) with `ngsw-config.json`

## Key app areas
- `cta-tracker/src/app/services/bus.service.ts`: API calls for routes, directions, stops, arrivals, and vehicle follow endpoints.
- `cta-tracker/src/app/services/favorites.service.ts`: local favorites management and favorites sync/save API calls.
- `cta-tracker/src/app/app-routing.module.ts`: route map for main feature pages.
- `cta-tracker/src/environments/`: environment-specific API base URL configuration.

## Useful commands
Run these from `cta-tracker/`:
- `npm install`
- `npm start` (dev server)
- `npm run build` (production build)
- `npm run watch` (development build in watch mode)
- `npm test`

## Development notes
- Components and pipes are configured for **NgModule declarations** (`standalone: false`).
- The app reads and writes selected values in `localStorage` (favorites and cached route metadata).
- Service-worker behavior is enabled through Angular build config and `ngsw-config.json`.
