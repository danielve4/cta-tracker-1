import { defineConfig } from 'vitest/config';

// Scoped deliberately to the dependency-free logic under services/prediction/. Those modules import
// nothing from Angular, so they need no TestBed, no jsdom and no Angular Vite plugin — which keeps
// this a plain Node runner rather than a second build system alongside the Angular CLI.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/app/**/*.spec.ts']
  }
});
