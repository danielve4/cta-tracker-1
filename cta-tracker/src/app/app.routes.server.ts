import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Prerendered static shells (served first-load / direct / SEO).
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'routes', renderMode: RenderMode.Prerender },
  { path: 'favorites', renderMode: RenderMode.Prerender },
  // Client-rendered: settings renders theme.isDark() (not server-determinable);
  // all :param/deep routes can't be prerendered without params.
  { path: 'settings', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Client }
];
