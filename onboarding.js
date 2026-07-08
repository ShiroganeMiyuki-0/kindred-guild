/**
 * Kindred Guild - Non-Disruptive Guided Tips Walkthrough
 * Location: shiroganemiyuki-0/kindred-guild/onboarding.js
 * Purpose: A purely informative tip tour. Does not trigger modals, clicks, or page redirects.
 */

(function () {
  let currentStep = 0;
  let backdrop = null;
  let tooltip = null;

  // 1. Static Tip Configuration (Targets existing elements on the Quest Board page)
  const onboardingSteps = [
    {
      target: '#quest-board-container, .quest-board, main, .container',
      title: "⚔️ Welcome to the Quest Board",
      intro: "This is the main hub of the Guild Hall! Here you can view, filter, and track active adventures posted by yourself and other members."
    },
    {
      // Strict layout selector to grab the yellow header action button directly
      target: 'button.btn-warning, .btn-post-task, #post-task-btn, [id*="post"]',
      title: "📜 Commissioning Quests",
      intro: "When you need help with real-world tasks or chores, you can use this button to draft a new quest scroll and post it up for the guild."
    },
    {
      target: '#coin-balance, .coin-display, #fairy-coins, [class*="coin"]',
      title: "🪙 Your Guild Pouch",
      intro: "Tracks your Fairy Coins (FC) balance. You spend coins as bounties to post quests, and earn them back by completing tasks for others."
    },
    {
      target: '.nav-links, #site-nav, .navbar, .flex-wrap',
      title: "🗺️ Guild Navigation",
      intro: "Quickly journey across the realm! Use these tabs to jump between your Profile settings, personal History logs, or the specialized Wish board."
    }
  ];

  // 2. Inject Dark Theme Custom UI Styles
  function injectStyles() {
    if (document.getElementById('kg-onboard-styles')) return;

    const style = document.createElement('style');
    style.id = 'kg-onboard-styles';
    style.textContent = `
      .kg-onboard-backdrop {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(8, 8, 12, 0.75);
        z-index: 9998;
        pointer-events: auto;
        transition: opacity 0.2s ease;
      }

      .kg-onboard-highlight {
        position: relative !important;
        z-index: 9999 !important;
        outline: 3px solid #d4af37 !important; /* Guild Gold Accent */
        box-shadow: 0 0 25px rgba(212, 175, 55, 0.45) !important;
        border-radius: 6px;
        
        /* CRITICAL: Prevents any underlying buttons/links from being clicked during the tour */
        pointer-events: none !important; 
      }

      .kg-onboard-tooltip {
        position: fixed;
        z-index: 10000;
        background: #161622;
        border: 1px solid #d4af37;
        border-radius: 12px;
        padding: 20px;
        width: 310px;
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
        color: #f0f0f5;
        font-family: system-ui, -apple-system, sans-serif;
        transition: all 0.2s ease-out;
      }

      .kg-onboard-tooltip h3 {
        margin: 0 0 8px 0;
        font-size: 1.1rem;
        color: #e5c158;
        border-bottom: 1px solid rgba(212, 175, 55, 0.15);
        padding-bottom: 6px;
      }

      .kg-onboard-tooltip p {
        margin: 0 0 16px 0;
        font-size: 0.92rem;
        line-height: 1.45;
        color: #bcccdd;
      }

      .kg-onboard-buttons {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .kg-onboard-btn {
        background: transparent;
        border: 1px solid #4a4a60;
        color: #9a9ab0;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        transition: all 0.2s;
      }

      .kg-onboard-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #fff;
      }

      .kg-onboard-btn-primary {
        background: #d4af37;
        border: 1px solid #d4af37;
        color: #0e0e15;
      }

      .kg-onboard-btn-primary:hover {
        background: #f1cc64;
        border-color: #f1cc64;
      }
    `;
    document.head.appendChild(style);
  }

  // 3. Strict Selector Query Matcher (Resolves context collision problems)
  function findElement(selectorString) {
    const selectors = selectorString.split(',');
    for (let sel of selectors) {
      sel = sel.trim();
      const el = document.querySelector(sel);
      
      // Ensure element exists, is visible, and isn't a sub-filter tab component
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        if (el.textContent.toLowerCase().includes('posted') && sel.includes('button')) {
          continue; // Guard clause against filter tab collision
        }
        return el;
      }
    }
    return null;
  }

  // 4. Pure Visual Rendering Cycle Loop
  function renderStep(index) {
    // Strip active highlights from previous steps cleanly
    document.querySelectorAll('.kg-onboard-highlight').forEach(el => el.classList.remove('kg-onboard-highlight'));

    if (index >= onboardingSteps.length) {
      endOnboarding();
      return;
    }

    currentStep = index;
    const stepData = onboardingSteps[currentStep];
    const targetElement = findElement(stepData.target);

    if (!targetElement) {
      console.warn(`Target step element missing or out of view context: ${stepData.target}. Skipping tip.`);
      renderStep(index + 1);
      return;
    }

    // Align layout smoothly to view screen parameters
    targetElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
    targetElement.classList.add('kg-onboard-highlight');

    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'kg-onboard-tooltip';
      document.body.appendChild(tooltip);
    }

    const isLast = currentStep === onboardingSteps.length - 1;

    tooltip.innerHTML = `
      <h3>${stepData.title}</h3>
      <p>${stepData.intro}</p>
      <div class="kg-onboard-buttons">
        <button class="kg-onboard-btn" id="kg-skip-btn">Skip Tour</button>
        <button class="kg-onboard-btn kg-onboard-btn-primary" id="kg-next-btn">
          ${isLast ? "Done ✨" : "Continue"}
        </button>
      </div>
    `;

    // Accurate Coordinate Position Mapping
    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.bottom + window.scrollY + 12;
    let left = rect.left + window.scrollX;

    // Reposition above if layout crosses beneath view bottom limits
    if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
      top = rect.top + window.scrollY - tooltipRect.height - 12;
    }
    // Prevent horizontal overflow bounds collisions
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 20;
    }
    if (left < 12) left = 12;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // Rebind navigation click listeners
    document.getElementById('kg-skip-btn').onclick = endOnboarding;
    document.getElementById('kg-next-btn').onclick = () => renderStep(currentStep + 1);
  }

  // 5. Build Initializers Hooks
  function startOnboarding(force = false) {
    if (!force && localStorage.getItem('kg_onboarding_completed') === 'true') return;

    injectStyles();

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'kg-onboard-backdrop';
      document.body.appendChild(backdrop);
    }

    renderStep(0);
  }

  // 6. Complete Removal Cleanup
  function endOnboarding() {
    localStorage.setItem('kg_onboarding_completed', 'true');

    if (backdrop) { backdrop.remove(); backdrop = null; }
    if (tooltip) { tooltip.remove(); tooltip = null; }

    document.querySelectorAll('.kg-onboard-highlight').forEach(el => el.classList.remove('kg-onboard-highlight'));
  }

  window.showOnboarding = function (forceStart = false) {
    startOnboarding(forceStart);
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startOnboarding(false);
  } else {
    document.addEventListener('DOMContentLoaded', () => startOnboarding(false));
  }
})();
