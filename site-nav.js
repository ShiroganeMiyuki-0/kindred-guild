// ============================================
// KINDRED GUILD — GLOBAL NAV + SCROLL GUIDE
// Include on EVERY page: <script src="site-nav.js"></script>
// Add this line right before </body>, after your other scripts.
// ============================================
(function () {
  // Pages where a "back to homepage" button would be redundant/confusing
  const HOME_PAGE = 'index.html';
  const path = window.location.pathname.split('/').pop() || 'index.html';

  // ---- 1. Floating Home / Back button ----
  const nav = document.createElement('div');
  nav.id = 'kg-floating-nav';
  nav.innerHTML = `
    <button id="kg-back-btn" title="Go back" aria-label="Go back">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <button id="kg-home-btn" title="Homepage" aria-label="Go to homepage">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 10.5L12 3l9 7.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5 9.5V21h14V9.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;
  document.body.appendChild(nav);

  if (path === HOME_PAGE) {
    document.getElementById('kg-back-btn').style.display = 'none';
  }

  document.getElementById('kg-back-btn').addEventListener('click', () => {
    // Prefer real browser history; fall back to homepage if this was a fresh tab/login redirect
    if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
      window.history.back();
    } else {
      window.location.href = HOME_PAGE;
    }
  });
  document.getElementById('kg-home-btn').addEventListener('click', () => {
    window.location.href = HOME_PAGE;
  });

  // ---- 2. Interactive scroll guide ----
  // Shows a pulsing "scroll for more" nudge if the page has more content below the fold,
  // and hides itself once the user reaches the bottom (or clicks it, which auto-scrolls).
  const scrollBtn = document.createElement('button');
  scrollBtn.id = 'kg-scroll-guide';
  scrollBtn.setAttribute('aria-label', 'Scroll for more');
  scrollBtn.innerHTML = `
    <span>More below</span>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  document.body.appendChild(scrollBtn);

  function updateScrollGuide() {
    const scrollable = document.body.scrollHeight - window.innerHeight > 120;
    const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 40;
    scrollBtn.style.display = scrollable && !atBottom ? 'flex' : 'none';
  }
  scrollBtn.addEventListener('click', () => {
    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
  });
  window.addEventListener('scroll', updateScrollGuide, { passive: true });
  window.addEventListener('resize', updateScrollGuide);
  setTimeout(updateScrollGuide, 400); // after layout/content settles

  // ---- 3. Styles (uses each page's existing theme variables, with safe fallbacks) ----
  const style = document.createElement('style');
  style.textContent = `
    #kg-floating-nav {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 9999;
      display: flex;
      gap: 8px;
    }
    #kg-floating-nav button {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 1px solid var(--surface-2, #2a2a35);
      background: var(--surface, #1a1a22);
      color: var(--accent, #c9a84c);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.35);
      transition: transform 0.15s ease, background 0.15s ease;
    }
    #kg-floating-nav button:hover {
      background: var(--surface-2, #252530);
      transform: translateY(-1px);
    }
    #kg-scroll-guide {
      position: fixed;
      bottom: 22px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: none;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 20px;
      border: 1px solid var(--surface-2, #2a2a35);
      background: var(--surface, #1a1a22);
      color: var(--accent, #c9a84c);
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(0,0,0,0.4);
      animation: kg-bounce 1.6s ease-in-out infinite;
    }
    @keyframes kg-bounce {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(5px); }
    }
    @media (max-width: 480px) {
      #kg-floating-nav { top: 10px; left: 10px; }
      #kg-floating-nav button { width: 36px; height: 36px; }
    }
  `;
  document.head.appendChild(style);
})();
