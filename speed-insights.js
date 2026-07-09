// Speed Insights integration for Kindred Guild
// Automatically injects Vercel Speed Insights tracking

import { injectSpeedInsights } from 'https://unpkg.com/@vercel/speed-insights@latest/dist/index.mjs';

// Initialize Speed Insights
injectSpeedInsights({
  framework: 'vanilla',
  debug: false
});
