/**
 * Kindred Guild - Context-Aware, Automated Onboarding Walkthrough
 * Location: shiroganemiyuki-0/kindred-guild/onboarding.js
 * Purpose: Automatically triggers non-blocking guide tips when users interact with
 * features for the first time. Keeps the page 100% interactive.
 */

(function () {
  // Track completed tips in localStorage to ensure they only trigger once per user life-cycle
  const storagePrefix = 'kg_tip_';
  let activeTooltip = null;
  let activeBackdrop = null;
  let currentHighlightedEl = null;

  // Define our 6 streamlined guide milestones
  const guideMilestones = {
    welcome: {
      id: 'welcome',
      target: '#quest-board-container, .quest-board, main',
      title: "⚔️ Welcome to the Guild Hall!",
      intro: "This is the active Quest Board where adventures and chores are pinned. Take on quests posted by others or draft your own!"
    },
    coins: {
      id: 'coins',
      target: '#coin-balance, .coin-display, #fairy-coins',
      title: "🪙 Your Coin Pouch",
      intro: "Fairy Coins (FC) drive the guild. Earn coins by completing quests, or spend them as bounties when you delegate tasks."
    },
    postBtn: {
      id: 'postBtn',
      target: 'button.btn-warning, .btn-post-task, #post-task-btn, [id*="post"]',
      title: "📜 Commissioning Quests",
      intro: "Need a chore done or a target met? Click here to commission a new quest scroll and reward helpers with Fairy Coins."
    },
    modalOpen: {
      id: 'modalOpen',
      target: '#post-task-modal, .modal-content, #quest-form',
      title: "✍️ Structuring Your Decree",
      intro: "Set a clear task description, assign category tags, and pledge a coin bounty. Real gold inspires real efforts!"
    },
    manageQuests: {
      id: 'manageQuests',
      target: '.my-posted-filter, [onclick*="Posted"], button:contains("My Posted")',
      title: "🛠️ Managing Your Quests",
      intro: "View, edit, or cancel your active decrees from this tab. You can easily modify bounties or delete drafts before helpers claim them."
    },
    navigation: {
      id: 'navigation',
      target: '.nav-links, #site-nav, .navbar',
      title: "🗺️ Navigating the Realm",
      intro: "Easily journey across your adventure logs! Check your Profile settings, active Quest History, or view magical Wishes."
    }
  };

  function injectStyles() {
    if (document.getElementById('kg-advanced-onboard-styles')) return;

    const style = document.createElement('style');
    style.id = 'kg-advanced-onboard-styles';
    style.textContent = `
      /* Cinematic, non-blocking theatrical dim overlay */
      .kg-onboard-vignette {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: radial-gradient(circle, rgba(14, 14, 22, 0.2) 40%, rgba(8, 8, 12, 0.65) 100%);
        z-index: 9998;
        pointer-events: none !important; /* Absolute interaction pass-through */
        transition: opacity 0.4s ease;
      }

      /* Non-blocking premium highlight */
      .kg-onboard-spotlight {
        position: relative !important;
        z-index: 9999 !important;
        outline: 2px solid #d4af37 !important;
        box-shadow: 0 0 20px rgba(212, 175, 55, 0.5), inset 0 0 10px rgba(212, 175, 55, 0.2) !important;
        border-radius: 8px;
        animation: kg-spotlight-glow 2.5s infinite ease-in-out;
        pointer-events: auto !important; /* Allow direct interactions with highlighted element */
      }

      @keyframes kg-spotlight-glow {
        0% { box-shadow: 0 0 15px rgba(212, 175, 55, 0.4); }
        50% { box-shadow: 0 0 25px rgba(212, 175, 55, 0.7); }
        100% { box-shadow: 0 0 15px rgba(212, 175, 55, 0.4); }
      }

      /* Elegant floating fantasy tooltip */
      .kg-onboard-card {
        position: fixed;
        z-index: 10000;
        background: #14141f;
        border: 1px solid #d4af37;
        border-radius: 12px;
        padding: 18px 22px;
        width: 320px;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.7);
        color: #f0f0f5;
        font-family: system-ui, -apple-system, sans-serif;
        transition: top 0.3s cubic-bezier(0.16, 1, 0.3, 1), left 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto !important; /* Keep card fully clickable */
      }

      .kg-onboard-card h4 {
        margin: 0 0 8px 0;
        font-size: 1.1rem;
        color: #e5c158;
        border-bottom: 1px solid rgba(212, 175, 55, 0.15);
        padding-bottom: 6px;
        font-weight: 700;
      }

      .kg-onboard-card p {
        margin: 0 0 16px 0;
        font-size: 0.92rem;
        line-height: 1.5;
        color: #ccd0df;
      }

      .kg-onboard-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .kg-onboard-progress {
        font-size: 0.78rem;
        color: #8c8ca5;
        font-weight: 500;
      }

      .kg-onboard-action-btn {
        background: #d4af37;
        border: 1px solid #d4af37;
        color: #0e0e15;
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 700;
        transition: all 0.2s ease;
      }

      .kg-onboard-action-btn:hover {
        background: #f1cc64;
        border-color: #f1cc64;
      }
    `;
    document.head.appendChild(style);
  }

  // Safe DOM finder helper
  function getElement(selectorString) {
    const selectors = selectorString.split(',');
    for (let selector of selectors) {
      selector = selector.trim();
      const el = document.querySelector(selector);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        // Prevent targeting filtering tabs when searching for functional buttons
        if (selector.includes('button') && el.textContent.toLowerCase().includes('posted')) {
          continue;
        }
        return el;
      }
    }
    return null;
  }

  // Clear current spotlight highlighting safely
  function clearHighlight() {
    if (currentHighlightedEl) {
      currentHighlightedEl.classList.remove('kg-onboard-spotlight');
      currentHighlightedEl = null;
    }
  }

  // Renders a targeted tooltip overlay dynamically
  function showGuidedTip(milestone, customNextCallback = null) {
    // If the milestone was already viewed by the user, bypass it
    if (localStorage.getItem(storagePrefix + milestone.id) === 'true') {
      return false;
    }

    const targetEl = getElement(milestone.target);
    if (!targetEl) return false;

    injectStyles();

    // Setup Vignette dim layer if missing
    if (!activeBackdrop) {
      activeBackdrop = document.createElement('div');
      activeBackdrop.className = 'kg-onboard-vignette';
      document.body.appendChild(activeBackdrop);
    }

    // Isolate previous highlights
    clearHighlight();

    // Generate floating card container
    if (!activeTooltip) {
      activeTooltip = document.createElement('div');
      activeTooltip.className = 'kg-onboard-card';
      document.body.appendChild(activeTooltip);
    }

    targetEl.classList.add('kg-onboard-spotlight');
    currentHighlightedEl = targetEl;

    activeTooltip.innerHTML = `
      <h4>${milestone.title}</h4>
      <p>${milestone.intro}</p>
      <div class="kg-onboard-footer">
        <span class="kg-onboard-progress">Guild Assistant</span>
        <button class="kg-onboard-action-btn" id="kg-onboard-ack">Got it!</button>
      </div>
    `;

    // Position coordinate calculations
    targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    
    setTimeout(() => {
      const rect = targetEl.getBoundingClientRect();
      const tooltipRect = activeTooltip.getBoundingClientRect();

      let top = rect.bottom + window.scrollY + 12;
      let left = rect.left + window.scrollX;

      // Swap positioning to render above elements if it falls below the viewport fold
      if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - tooltipRect.height - 12;
      }
      // Guarantee left/right boundaries aren't clipped
      if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 20;
      }
      if (left < 12) left = 12;

      activeTooltip.style.top = `${top}px`;
      activeTooltip.style.left = `${left}px`;
    }, 150);

    // Acknowledge event listener to clear/save state
    document.getElementById('kg-onboard-ack').onclick = function () {
      localStorage.setItem(storagePrefix + milestone.id, 'true');
      dismissActiveTip();

      // Trigger sequential actions if attached
      if (typeof customNextCallback === 'function') {
        customNextCallback();
      }
    };

    return true;
  }

  // Dismiss overlays cleanly without blocking interactive behaviors
  function dismissActiveTip() {
    clearHighlight();
    if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }
    if (activeBackdrop) { activeBackdrop.remove(); activeBackdrop = null; }
  }

  // Monitors user actions and automatically pushes notifications real-time
  function initAutomatedTriggers() {
    // 1. Welcome & Coin Pouch (Sequence trigger on initial landing)
    setTimeout(() => {
      showGuidedTip(guideMilestones.welcome, () => {
        // Automatically chain-triggers Coin Pouch highlight immediately after they close Welcome
        setTimeout(() => {
          showGuidedTip(guideMilestones.coins, () => {
            // Then chain-trigger Post Quest highlight
            setTimeout(() => {
              showGuidedTip(guideMilestones.postBtn);
            }, 500);
          });
        }, 500);
      });
    }, 1000);

    // 2. Intercept "Post Task" Modal Open Trigger
    document.body.addEventListener('click', (e) => {
      const postBtnTarget = e.target.closest('button.btn-warning, .btn-post-task, #post-task-btn, [id*="post"]');
      if (postBtnTarget) {
        // Wait a split second for the modal opening transition to complete, then highlight it
        setTimeout(() => {
          showGuidedTip(guideMilestones.modalOpen);
        }, 400);
      }
    });

    // 3. Intercept Filter Changes to guide Edit/Delete Actions
    document.body.addEventListener('click', (e) => {
      const manageTarget = e.target.closest('.my-posted-filter, [onclick*="Posted"], button:contains("My Posted")') || 
                           (e.target.textContent && e.target.textContent.trim().toLowerCase() === 'my posted');
      if (manageTarget) {
        setTimeout(() => {
          showGuidedTip(guideMilestones.manageQuests);
        }, 400);
      }
    });

    // 4. Intercept Profile / Navigation Elements Hover or Interaction
    const navEl = getElement('.nav-links, #site-nav, .navbar');
    if (navEl) {
      const triggerNavTip = () => {
        if (showGuidedTip(guideMilestones.navigation)) {
          navEl.removeEventListener('mouseenter', triggerNavTip);
        }
      };
      navEl.addEventListener('mouseenter', triggerNavTip);
    }
  }

  // Expose reset interface via Guide navigation element to restart onboarding
  window.showOnboarding = function (forceStart = false) {
    if (forceStart) {
      // Flush storage flags for all milestones
      Object.keys(guideMilestones).forEach(key => {
        localStorage.removeItem(storagePrefix + guideMilestones[key].id);
      });
      localStorage.removeItem('kg_onboarding_completed');
    }
    dismissActiveTip();
    initAutomatedTriggers();
  };

  // Run immediately on page mount
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initAutomatedTriggers();
  } else {
    document.addEventListener('DOMContentLoaded', initAutomatedTriggers);
  }
})();
