/**
 * Vercel Speed Insights Initialization
 * This file initializes Vercel Speed Insights for the Kindred Guild application
 */

(function() {
  'use strict';

  // Initialize the queue for Speed Insights
  function initQueue() {
    if (window.si) return;
    window.si = function(...params) {
      (window.siq = window.siq || []).push(params);
    };
  }

  // Detect if we're in development mode
  function isDevelopment() {
    try {
      return window.location.hostname === 'localhost' || 
             window.location.hostname === '127.0.0.1' ||
             window.location.hostname === '';
    } catch (e) {
      return false;
    }
  }

  // Inject the Speed Insights script
  function injectSpeedInsights() {
    // Initialize the queue first
    initQueue();

    // Determine the script source
    const src = isDevelopment() 
      ? 'https://va.vercel-scripts.com/v1/speed-insights/script.debug.js'
      : '/_vercel/speed-insights/script.js';

    // Check if script is already loaded
    if (document.head.querySelector(`script[src*="${src}"]`)) {
      return;
    }

    // Create and configure the script element
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.sdkn = '@vercel/speed-insights';
    script.dataset.sdkv = '1.3.1';

    // Set the route (current pathname)
    const route = window.location.pathname;
    if (route) {
      script.dataset.route = route;
    }

    // Error handler
    script.onerror = function() {
      console.log(
        '[Vercel Speed Insights] Failed to load script from ' + src + 
        '. Please check if any content blockers are enabled and try again.'
      );
    };

    // Append script to head
    document.head.appendChild(script);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSpeedInsights);
  } else {
    // DOM is already ready
    injectSpeedInsights();
  }
})();
