// ============================================
// KINDRED GUILD — GLOBAL NAVIGATION
// Include on EVERY page: <script src="site-nav.js"></script>
// Add right before </body>, after other scripts.
// ============================================
(function () {
  const HOME = 'index.html';
  const path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  // ---- 1. Floating back + home buttons ----
  const nav = document.createElement('div');
  nav.id = 'kg-floating-nav';
  nav.innerHTML = `
    <button id="kg-back-btn" title="Go back" aria-label="Go back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <button id="kg-home-btn" title="Homepage" aria-label="Go to homepage">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M3 10.5L12 3l9 7.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5 9.5V21h14V9.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <button id="kg-guide-btn" title="Show me around" aria-label="Show guide">
      <span>🎮</span>
    </button>
  `;
  document.body.appendChild(nav);

  // ---- Guide button: works from any page ----
  document.getElementById('kg-guide-btn').addEventListener('click', () => {
    if (typeof window.showOnboarding === 'function') {
      // onboarding.js is loaded on this page (quest-board.html or quest-post.html)
      window.showOnboarding(true);
    } else {
      // Guide lives on the Quest Board — jump there and auto-start it
      window.location.href = 'quest-board.html?startGuide=1';
    }
  });

  if (path === HOME) {
    document.getElementById('kg-back-btn').style.display = 'none';
  }

  document.getElementById('kg-back-btn').addEventListener('click', () => {
    if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
      window.history.back();
    } else {
      window.location.href = HOME;
    }
  });
  document.getElementById('kg-home-btn').addEventListener('click', () => {
    window.location.href = HOME;
  });

  // ---- 2. Scroll guide (bottom center nudge) ----
  const scrollBtn = document.createElement('button');
  scrollBtn.id = 'kg-scroll-guide';
  scrollBtn.setAttribute('aria-label', 'Scroll for more');
  scrollBtn.innerHTML = `
    <span>More below</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  document.body.appendChild(scrollBtn);

  function updateScrollGuide() {
    const scrollable = document.body.scrollHeight - window.innerHeight > 100;
    const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 30;
    scrollBtn.style.display = scrollable && !atBottom ? 'flex' : 'none';
  }
  scrollBtn.addEventListener('click', () => {
    window.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' });
  });
  window.addEventListener('scroll', updateScrollGuide, { passive: true });
  window.addEventListener('resize', updateScrollGuide);
  setTimeout(updateScrollGuide, 300);

  // ---- 3. Inject styles ----
  const style = document.createElement('style');
  style.textContent = `
    #kg-floating-nav {
      position: fixed;
      top: 14px;
      left: 14px;
      z-index: 9999;
      display: flex;
      gap: 6px;
    }
    #kg-floating-nav button {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 1px solid var(--border, #262636);
      background: var(--surface, #14141e);
      color: var(--accent, #d4af37);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      transition: transform 0.15s, background 0.15s;
    }
    #kg-floating-nav button:hover {
      background: var(--surface-2, #20202d);
      transform: translateY(-1px);
    }
    #kg-guide-btn { font-size: 15px; }
    #kg-scroll-guide {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: none;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 20px;
      border: 1px solid var(--border, #262636);
      background: var(--surface, #14141e);
      color: var(--accent, #d4af37);
      font-size: 12px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(0,0,0,0.5);
      animation: kg-bounce 1.8s ease-in-out infinite;
    }
    @keyframes kg-bounce {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(4px); }
    }
    @media (max-width: 768px) {
      #kg-floating-nav { top: 10px; left: 10px; }
      #kg-floating-nav button { width: 34px; height: 34px; }
      #kg-scroll-guide { font-size: 11px; padding: 6px 12px; }
    }
  `;
  document.head.appendChild(style);
})();
