// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // Sekvenčné spúšťanie testov
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Jeden worker kvôli sekvenčnosti
  reporter: [
    ['html'],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:5510',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'node server.mjs',
    url: 'http://localhost:5510',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
