export const environment = {
  production: true,
  baseURL: 'https://cta.danielvega.dev',
  // CTA alerts send no CORS headers, so they come through a Cloudflare Worker (workers/alerts-proxy/).
  alertsBaseURL: 'https://cta-alerts-proxy.danve4.workers.dev'
};
