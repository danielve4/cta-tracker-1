export const environment = {
  production: false,
  // baseURL: 'http://localhost:8080'
  baseURL: 'https://cta.danielvega.dev/',
  // CTA alerts send no CORS headers, so they come through a Cloudflare Worker (workers/alerts-proxy/).
  // Run `npm run dev` there and use 'http://localhost:8787' to try Worker changes locally.
  alertsBaseURL: 'https://cta-alerts-proxy.danve4.workers.dev'
};
