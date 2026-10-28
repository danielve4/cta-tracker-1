import { defineConfig } from 'vitest/config';

// The handler takes its upstream fetch as a parameter, so it runs on Node's own Request/Response
// with no Workers runtime emulation.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts']
  }
});
