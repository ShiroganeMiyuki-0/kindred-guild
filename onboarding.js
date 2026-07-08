/**
 * Kindred Guild - Onboarding Walkthrough Script
 * Location: shiroganemiyuki-0/kindred-guild/onboarding.js
 * Purpose: A purely informational guide that explains features without forcing interactions or triggering modals.
 */

(function () {
  // 1. Define the step configurations using element fallbacks
  const onboardingSteps = [
    {
      element: '#quest-board-container, .quest-board, #quest-board',
      title: "⚔️ The Quest Board",
      intro: "Welcome to the Guild! This is where all active tasks and adventures are listed. You can browse through available quests posted by other guild members."
    },
    {
      element: '#btn-post-task, .btn-post-task, [onclick*="post"], #post-task-btn',
      title: "📜 Posting a New Quest",
      intro: "When you have tasks, chores, or goals you need help with, this section allows you to post them as new quests to the board. (Don't worry, we won't open it right now!)"
    },
    {
      element: '#coin-balance, .coin-display, #fairy-coins',
      title: "🪙 Fairy Coins Balance",
      intro: "Track your rewards here! Complete quests to earn coins, or spend them to post your own requests for other adventurers to tackle."
    },
    {
      element: '.nav-links, #site-nav, .sidebar',
      title: "🗺️ Guild Navigation",
      intro: "Use these links to easily hop between your Profile, the Hall of Fame, and your personal Quest History tracker."
    }
  ];

  let currentStep = 0;
  let backdrop = null;
  let tooltip = null;

  // 2. Inject Required Styling into the Document Head
  function injectStyles() {
    if (document.getElementById('kg-onboard-styles')) return;

    const style = document.createElement('style');
    style.id = 'kg-onboard-styles';
    style.textContent = `
      /* Dark Backdrop Mask */
      .kg-onboard-backdrop {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(10, 10, 16, 0.75);
        z-index: 9998;
        pointer-events: auto;
        transition: opacity 0.3s ease;
      }

      /* Highlight styling for the current element */
      .kg-onboard-highlight {
        position: relative !important;
        z-index: 9999 !important;
        outline: 3px solid #d4af37 !important; /* Guild Gold border */
        box-shadow: 0 0 20px rgba(212, 175, 55, 0.4) !important;
        border-radius: 8px;
        background: #14141e !important;
        
        /* FIX: Prevents underlying buttons or modal open scripts from firing when clicked */
        pointer-events: none !important; 
      }

      /* Beautiful Guild-Themed Tooltip Card */
      .kg-onboard-tooltip {
        position: fixed;
        z-index: 10000;
        background: #1c1c27;
        border: 1px solid #d4af37;
        border-radius: 12px;
        padding: 20px;
        width: 320px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        color: #f0f0f5;
        font-family: system-ui, -apple-system, sans-serif;
        transition: all 0.25s ease;
      }

      .kg-onboard-tooltip h3 {
        margin: 0 0 10px 0;
        font-size: 1.15rem;
        color: #e5c158;
        border-bottom: 1px solid rgba(212, 175, 55, 0.2);
        padding-bottom: 6px;
      }

      .kg-onboard-tooltip p {
        margin: 0 0 16px 0;
        font-size: 0.95rem;
        line-height: 1.5;
        color: #ccccdd;
      }

      .kg-onboard-buttons {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .kg-onboard-btn {
        background: transparent;
        border: 1px solid #5a5a75;
        color: #a0a0b8;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        transition: all 0.2s ease;
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
        color: #0e0e15;
      }
    `;
    document.head.appendChild(style);
  }

  // 3. Helper to locate live DOM elements through fallbacks
  function findElement(selectorString) {
    const selectors = selectorString.split(',');
    for (let sel of selectors) {
      const el = document.querySelector(sel.trim());
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        return el;
      }
    }
    return null;
  }

  // 4. Render Step Content and Calculate Position Coordinates
  function renderStep(index) {
    // Clear out preceding structural highlights
    document.querySelectorAll('.kg-onboard-highlight').forEach(el => {
      el.classList.remove('kg-onboard-highlight');
    });

    if (index >= onboardingSteps.length) {
      endOnboarding();
      return;
    }

    currentStep = index;
    const stepData = onboardingSteps[currentStep];
    const targetElement = findElement(stepData.element);

    if (!targetElement) {
      // Skip cleanly if the step element layout variant is missing on this specific page view
      console.warn(`Onboarding target selector not found: ${stepData.element}. Skipping step.`);
      renderStep(index + 1);
      return;
    }

    // Scroll elements into alignment cleanly if needed
    targetElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
    targetElement.classList.add('kg-onboard-highlight');

    // Generate tooltip frame layout if non-existent
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
          ${isLast ? "Finish 🎉" : "Continue"}
        </button>
      </div>
    `;

    // Calculate rendering alignment bounds dynamic offsetting
    setTimeout(() => {
      const rect = targetElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      let top = rect.bottom + window.scrollY + 12;
      let left = rect.left + window.scrollX;

      // Adjust up if layout drops past display fold lines
      if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - tooltipRect.height - 12;
      }

      // Constrain context bounds inside inner page view parameters
      if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 20;
      }
      if (left < 10) left = 10;

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
    }, 100);

    // Explicit manual click handlers to isolate tour state mutations
    document.getElementById('kg-skip-btn').onclick = endOnboarding;
    document.getElementById('kg-next-btn').onclick = () => renderStep(currentStep + 1);
  }

  // 5. Run Execution Sequence Loop Initializer
  function startOnboarding(force = false) {
    if (!force && localStorage.getItem('kg_onboarding_completed') === 'true') {
      return;
    }

    injectStyles();

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'kg-onboard-backdrop';
      document.body.appendChild(backdrop);
    }

    renderStep(0);
  }

  // 6. Tear down Walkthrough variables context completely
  function endOnboarding() {
    localStorage.setItem('kg_onboarding_completed', 'true');

    if (backdrop) {
      backdrop.remove();
      backdrop = null;
    }
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }

    document.querySelectorAll('.kg-onboard-highlight').forEach(el => {
      el.classList.remove('kg-onboard-highlight');
    });
  }

  // Bind to international window layout context for quest-board.html button triggers
  window.showOnboarding = function (forceStart = false) {
    startOnboarding(forceStart);
  };

  // Check interactive attachment state lifecycle hooks
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startOnboarding(false);
  } else {
    document.addEventListener('DOMContentLoaded', () => startOnboarding(false));
  }
})();
