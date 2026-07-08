/**
 * Kindred Guild - Non-Blocking Guided Tips Walkthrough
 * Location: shiroganemiyuki-0/kindred-guild/onboarding.js
 * Purpose: A beautiful fantasy-themed guided tour that explains layout features
 * while keeping the page 100% interactive and clickable at all times.
 */

(function () {
  let currentStep = 0;
  let backdrop = null;
  let tooltip = null;

  // 1. Defined steps targeting the key elements of your dashboard
  const onboardingSteps = [
    {
      target: '#quest-board-container, .quest-board, main, .container',
      title: "⚔️ Welcome to the Quest Board",
      intro: "This is the central heart of the Guild! Here, you can view, filter, and track all active adventures posted by your fellow guild members."
    },
    {
      // Target the yellow "Post Task" button precisely
      target: 'button.btn-warning, button[onclick*="Post"], button[onclick*="post"], .btn-post-task, #post-task-btn',
      title: "📜 Commissioning Quests",
      intro: "Need something done? Click this button to draft a new quest scroll, set a coin bounty, and pin it to the board for other adventurers."
    },
    {
      target: '#coin-balance, .coin-display, #fairy-coins, [class*="coin"]',
      title: "🪙 Your Guild Coin Pouch",
      intro: "This displays your current Fairy Coins (FC) balance. Post quests to spend them as rewards, or accept and complete quests to earn more!"
    },
    {
      target: '.nav-links, #site-nav, .navbar, .flex-wrap',
      title: "🗺️ Guild Navigation",
      intro: "Use these navigation links to easily travel between your Profile settings, active Quest History, or the magical Wish board."
    }
  ];

  // 2. Inject CSS styles containing the critical pointer-events fix
  function injectStyles() {
    if (document.getElementById('kg-onboard-styles')) return;

    const style = document.createElement('style');
    style.id = 'kg-onboard-styles';
    style.textContent = `
      /* The Dark Tint Layer */
      .kg-onboard-backdrop {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(8, 8, 12, 0.5); /* Soft, cinematic dim */
        z-index: 9998;
        transition: opacity 0.3s ease;
        
        /* FIX: Allows all clicks to pass straight through this layer to the page */
        pointer-events: none !important; 
      }

      /* Glowing Pulsing Outline around the active element */
      .kg-onboard-highlight {
        position: relative !important;
        z-index: 9999 !important;
        outline: 3px solid #d4af37 !important; /* Elegant Guild Gold */
        box-shadow: 0 0 15px rgba(212, 175, 55, 0.6), 0 0 0 4px rgba(212, 175, 55, 0.2) !important;
        border-radius: 6px;
        animation: kg-glowing-pulse 2s infinite ease-in-out;
        
        /* Ensure highlighted items can still be hovered/interacted with normally */
        pointer-events: auto !important; 
      }

      @keyframes kg-glowing-pulse {
        0% { box-shadow: 0 0 15px rgba(212, 175, 55, 0.6), 0 0 0 0px rgba(212, 175, 55, 0.3); }
        50% { box-shadow: 0 0 25px rgba(212, 175, 55, 0.8), 0 0 0 8px rgba(212, 175, 55, 0); }
        100% { box-shadow: 0 0 15px rgba(212, 175, 55, 0.6), 0 0 0 0px rgba(212, 175, 55, 0.3); }
      }

      /* Premium Floating Tooltip Box */
      .kg-onboard-tooltip {
        position: fixed;
        z-index: 10000;
        background: #151522;
        border: 1px solid #d4af37;
        border-radius: 12px;
        padding: 20px;
        width: 310px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), inset 0 0 10px rgba(212, 175, 55, 0.05);
        color: #f0f0f5;
        font-family: system-ui, -apple-system, sans-serif;
        transition: top 0.25s ease-out, left 0.25s ease-out;
        
        /* Crucial: Must accept mouse clicks so buttons can be clicked */
        pointer-events: auto !important; 
      }

      .kg-onboard-tooltip h3 {
        margin: 0 0 8px 0;
        font-size: 1.1rem;
        color: #e5c158;
        border-bottom: 1px solid rgba(212, 175, 55, 0.15);
        padding-bottom: 8px;
        font-weight: 700;
      }

      .kg-onboard-tooltip p {
        margin: 0 0 16px 0;
        font-size: 0.92rem;
        line-height: 1.5;
        color: #ccd0df;
      }

      .kg-onboard-buttons {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .kg-onboard-btn {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid #4a4a60;
        color: #a0a0ba;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        transition: all 0.2s ease;
      }

      .kg-onboard-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
        border-color: #626280;
      }

      .kg-onboard-btn-primary {
        background: #d4af37;
        border: 1px solid #d4af37;
        color: #0e0e15;
      }

      .kg-onboard-btn-primary:hover {
        background: #f1cc64;
        border-color: #f1cc64;
        color: #0c0c12;
      }
    `;
    document.head.appendChild(style);
  }

  // 3. Strict query selector engine avoiding tab index collisions
  function findElement(selectorString) {
    const selectors = selectorString.split(',');
    for (let sel of selectors) {
      sel = sel.trim();
      const el = document.querySelector(sel);
      
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        // Prevent matching filter tabs instead of the real action buttons
        if (el.textContent.toLowerCase().includes('posted') && sel.includes('button')) {
          continue; 
        }
        return el;
      }
    }
    return null;
  }

  // 4. Draw step indicators
  function renderStep(index) {
    // Clean old highlights
    document.querySelectorAll('.kg-onboard-highlight').forEach(el => el.classList.remove('kg-onboard-highlight'));

    if (index >= onboardingSteps.length) {
      endOnboarding();
      return;
    }

    currentStep = index;
    const stepData = onboardingSteps[currentStep];
    const targetElement = findElement(stepData.target);

    if (!targetElement) {
      console.warn(`Target step element missing: ${stepData.target}. Advancing to next tip.`);
      renderStep(index + 1);
      return;
    }

    // Scroll cleanly to target element
    targetElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
    targetElement.classList.add('kg-onboard-highlight');

    // Create floating card if missing
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

    // Calculate positioning offsets
    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.bottom + window.scrollY + 12;
    let left = rect.left + window.scrollX;

    // Reposition above element if it slips below viewport fold line
    if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
      top = rect.top + window.scrollY - tooltipRect.height - 12;
    }
    // Prevent clipping horizontal viewport borders
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 24;
    }
    if (left < 12) left = 12;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // Hook listeners
    document.getElementById('kg-skip-btn').onclick = endOnboarding;
    document.getElementById('kg-next-btn').onclick = () => renderStep(currentStep + 1);
  }

  // 5. Initializer interface
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

  // 6. Complete tear down
  function endOnboarding() {
    localStorage.setItem('kg_onboarding_completed', 'true');

    if (backdrop) { backdrop.remove(); backdrop = null; }
    if (tooltip) { tooltip.remove(); tooltip = null; }

    document.querySelectorAll('.kg-onboard-highlight').forEach(el => el.classList.remove('kg-onboard-highlight'));
  }

  // Global window handle for quest-board.html trigger buttons
  window.showOnboarding = function (forceStart = false) {
    startOnboarding(forceStart);
  };

  // Run immediately on setup
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startOnboarding(false);
  } else {
    document.addEventListener('DOMContentLoaded', () => startOnboarding(false));
  }
})();
