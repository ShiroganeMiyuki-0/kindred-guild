/**
 * Kindred Guild - Advanced Interactive Onboarding Walkthrough
 * Location: shiroganemiyuki-0/kindred-guild/onboarding.js
 * Purpose: Actively drives the UI, triggers modals, and cleans up states on completion or skip.
 */

(function () {
  let currentStep = 0;
  let backdrop = null;
  let tooltip = null;

  // 1. Core Step Configurations with Interactive State Hooks
  const onboardingSteps = [
    {
      target: '#quest-board-container, .quest-board, main',
      title: "⚔️ The Quest Board",
      intro: "Welcome to the Guild Hall! This is your live board where all active community and personal quests are displayed.",
      action: null // No action needed for intro
    },
    {
      target: 'button:has-text("Post Task"), button:has-text("Post a Task"), #post-task-btn, .btn-warning',
      title: "📜 Ready to Delegate?",
      intro: "This button lets you issue a new guild decree. Let's click 'Continue' to programmatically open the ledger and see how it looks!",
      action: null
    },
    {
      target: '#post-task-modal, .modal, #quest-form, [id*="modal"]',
      title: "✍️ Crafting a Quest",
      intro: "Behold the Quest Scroll! Here you define your task descriptions, categorize them with tags, and set the bounty. Let's move on.",
      // ACTION: Automatically open the modal when entering this step
      action: function() {
        // Try finding the button highlighted in the previous step and click it
        const postBtn = findElement('button:has-text("Post Task"), button:has-text("Post a Task"), #post-task-btn, .btn-warning');
        if (postBtn) {
          postBtn.click();
        } else {
          // Fallback if click fails: try finding common modal containers and force reveal them
          const modal = findElement('#post-task-modal, .modal, [id*="modal"]');
          if (modal) modal.style.display = 'block';
        }
      }
    },
    {
      target: '#coin-balance, .coin-display, #fairy-coins',
      title: "🪙 Fairy Coins Balance",
      intro: "Your personal treasury! Posting quests dispenses coins as rewards, while completing quests refills your pouch.",
      // ACTION: Close the modal since we are moving to a different UI element
      action: function() {
        closeActiveModals();
      }
    }
  ];

  // 2. Inject Refined Theme UI Styles
  function injectStyles() {
    if (document.getElementById('kg-onboard-styles')) return;

    const style = document.createElement('style');
    style.id = 'kg-onboard-styles';
    style.textContent = `
      .kg-onboard-backdrop {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(8, 8, 12, 0.8);
        z-index: 9998;
        pointer-events: auto;
        transition: opacity 0.25s ease;
      }

      .kg-onboard-highlight {
        position: relative !important;
        z-index: 9999 !important;
        outline: 3px solid #d4af37 !important;
        box-shadow: 0 0 25px rgba(212, 175, 55, 0.5) !important;
        border-radius: 8px;
        /* ALLOW interactions inside the highlighted element (like forms or scrollbars) */
        pointer-events: auto !important; 
      }

      .kg-onboard-tooltip {
        position: fixed;
        z-index: 10000;
        background: #171722;
        border: 1px solid #d4af37;
        border-radius: 12px;
        padding: 22px;
        width: 320px;
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
        color: #f0f0f5;
        font-family: system-ui, -apple-system, sans-serif;
        transition: all 0.2s ease-out;
      }

      .kg-onboard-tooltip h3 {
        margin: 0 0 10px 0;
        font-size: 1.15rem;
        color: #e5c158;
        border-bottom: 1px solid rgba(212, 175, 55, 0.2);
        padding-bottom: 8px;
      }

      .kg-onboard-tooltip p {
        margin: 0 0 18px 0;
        font-size: 0.95rem;
        line-height: 1.5;
        color: #b9b9cb;
      }

      .kg-onboard-buttons {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .kg-onboard-btn {
        background: transparent;
        border: 1px solid #4a4a65;
        color: #a0a0b8;
        padding: 8px 14px;
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

  // 3. Intelligent Element Query Finder (Fixes selector collision bugs)
  function findElement(selectorString) {
    const selectors = selectorString.split(',');
    for (let sel of selectors) {
      sel = sel.trim();
      
      // Dynamic Text Content Matcher for button structures
      if (sel.includes(':has-text(')) {
        const textToFind = sel.match(/"([^"]+)"/)[1];
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const found = buttons.find(b => b.textContent.trim().toLowerCase().includes(textToFind.toLowerCase()));
        if (found && found.offsetWidth > 0) return found;
        continue;
      }

      const el = document.querySelector(sel);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        return el;
      }
    }
    return null;
  }

  // 4. Close Modals Gracefully Helper
  function closeActiveModals() {
    // Try standard UI close button trigger click
    const closeBtn = document.querySelector('#post-task-modal .close, [onclick*="closeModal"], .modal-close');
    if (closeBtn) {
      closeBtn.click();
    } else {
      // Direct DOM manipulation fallback
      const modal = document.querySelector('#post-task-modal, .modal');
      if (modal) modal.style.display = 'none';
    }
  }

  // 5. Execution Step Router
  function renderStep(index) {
    document.querySelectorAll('.kg-onboard-highlight').forEach(el => el.classList.remove('kg-onboard-highlight'));

    if (index >= onboardingSteps.length) {
      endOnboarding();
      return;
    }

    currentStep = index;
    const stepData = onboardingSteps[currentStep];

    // Fire the interactive state actions if defined
    if (typeof stepData.action === 'function') {
      stepData.action();
    }

    // Small delay allows programmatic UI/modal animations to finalize before calculation
    setTimeout(() => {
      const targetElement = findElement(stepData.target);

      if (!targetElement) {
        console.warn(`Onboarding target not ready or missing: ${stepData.target}. Skipping step.`);
        renderStep(index + 1);
        return;
      }

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
            ${isLast ? "Complete 🎉" : "Continue"}
          </button>
        </div>
      `;

      // Context Alignment Positioning Calculations
      const rect = targetElement.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      let top = rect.bottom + window.scrollY + 14;
      let left = rect.left + window.scrollX;

      if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - tooltipRect.height - 14;
      }
      if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 24;
      }
      if (left < 12) left = 12;

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;

      document.getElementById('kg-skip-btn').onclick = endOnboarding;
      document.getElementById('kg-next-btn').onclick = () => renderStep(currentStep + 1);
    }, 150);
  }

  // 6. Global Initializer Hooks
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

  // 7. Dynamic Cleanup
  function endOnboarding() {
    localStorage.setItem('kg_onboarding_completed', 'true');
    closeActiveModals();

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
