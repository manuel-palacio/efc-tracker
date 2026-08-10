'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8123',
  },
  webServer: {
    command: 'python3 -m http.server 8123 --directory public',
    url: 'http://localhost:8123/index.html',
    reuseExistingServer: true,
  },
});
