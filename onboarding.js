/**
 * Kindred Guild - Context-Aware, Automated Onboarding Walkthrough
 * Copyright (c) 2026 Kindred Guild. All Rights Reserved.
 * Unauthorized copying or redistribution is prohibited.
 * Location: shiroganemiyuki-0/kindred-guild/onboarding.js
 * Purpose: Automatically triggers non-blocking guide tips the first time a user
 * lands on a page or interacts with a feature. Fully non-blocking (page stays
 * 100% interactive underneath). Also triggerable manually via the floating
 * "Guide" button (added in site-nav.js) on ANY page.
 *
 * Include this file on: quest-board.html, quest-post.html, fairy-wishes.html,
 * worker-post.html, undo-history.html, and profile.html.
 * (site-nav.js's Guide button works from any other page too — it redirects
 * to quest-board.html and auto-starts the core guide there.)
 */

(function () {
  const storagePrefix = 'kg_tip_';
  let activeTooltip = null;
  let activeBackdrop = null;
  let currentHighlightedEl = null;

  const path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  // ---- Milestones for the Quest Board (the main hub) ----
  const questBoardMilestones = {
    welcome: {
      id: 'welcome',
      target: '.container, main, body',
      title: '⚔️ Welcome to the Guild Hall!',
      intro: 'This is the active Quest Board where adventures and chores are pinned. Take on quests posted by others or draft your own!'
    },
    coins: {
      id: 'coins',
      target: '#coinBalanceContainer, #coinBalance',
      title: '🪙 Your Coin Pouch',
      intro: 'Fairy Coins (FC) drive the guild. Earn coins by completing quests, or spend them as bounties when you delegate tasks.'
    },
    postBtn: {
      id: 'postBtn',
      target: 'a[href="quest-post.html"]',
      title: '📜 Commissioning Quests',
      intro: 'Need a chore done or a target met? Click here to commission a new quest and reward helpers with Fairy Coins.'
    },
    manageQuests: {
      id: 'manageQuests',
      target: '#view-posted',
      title: '🛠️ Managing Your Quests',
      intro: 'View, edit, or cancel your active quests from here. You can easily modify bounties or delete drafts before helpers claim them.'
    },
    navigation: {
      id: 'navigation',
      target: '#kg-floating-nav',
      title: '🗺️ Navigating the Realm',
      intro: 'Use these floating buttons to go back or jump home anytime. Your Profile, Workers, and Wishes are all one tap away.'
    }
  };

  // ---- Milestone for the Post Task page ----
  const questPostMilestones = {
    postForm: {
      id: 'postForm',
      target: '#questForm',
      title: '✍️ Structuring Your Decree',
      intro: 'Set a clear title and description, pick Fairy Coins / UPI / Free, set a deadline, then hit Post Task. Real rewards inspire real effort!'
    }
  };

  // ---- Feature Tour: separate intros for the rest of the site, one per page ----
  const fairyWishesMilestones = {
    wishesIntro: {
      id: 'wishesIntro',
      target: '.wish-filters, #wishesFeed, .container',
      title: '✨ The Fairy Wishes Board',
      intro: 'This is the guild wishlist — community-funded ideas. Vote for wishes you care about, or scroll down to pitch your own and rally coin backers.'
    }
  };

  const workerPostMilestones = {
    workersIntro: {
      id: 'workersIntro',
      target: '.post-form, .container',
      title: '🛡️ List Yourself as a Worker',
      intro: 'Post your skills, add tags like #coding or #art, and set your rate here. Quest-givers browsing for help will be able to find and hire you.'
    }
  };

  const undoHistoryMilestones = {
    undoIntro: {
      id: 'undoIntro',
      target: '#actionHistoryContainer, .container',
      title: '📜 Your Undo History',
      intro: "Made a mistake? Recent reversible actions show up here so you can undo them — a safety net for accidental edits, deletes, or approvals."
    }
  };

  const profileMilestones = {
    profileIntro: {
      id: 'profileIntro',
      target: '.profile-card, .container',
      title: '🪪 Your Guild Profile',
      intro: 'Track your reputation, browse your Posted and Completed quests, and open Settings to update your display name, avatar, or UPI payout details.'
    }
  };

  const allMilestoneGroups = [
    questBoardMilestones,
    questPostMilestones,
    fairyWishesMilestones,
    workerPostMilestones,
    undoHistoryMilestones,
    profileMilestones
  ];

  function injectStyles() {
    if (document.getElementById('kg-advanced-onboard-styles')) return;

    const style = document.createElement('style');
    style.id = 'kg-advanced-onboard-styles';
    style.textContent = `
      .kg-onboard-vignette {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: radial-gradient(circle, rgba(14, 14, 22, 0.2) 40%, rgba(8, 8, 12, 0.65) 100%);
        z-index: 9998;
        pointer-events: none !important;
        transition: opacity 0.4s ease;
      }

      .kg-onboard-spotlight {
        position: relative !important;
        z-index: 9999 !important;
        outline: 2px solid #d4af37 !important;
        box-shadow: 0 0 20px rgba(212, 175, 55, 0.5), inset 0 0 10px rgba(212, 175, 55, 0.2) !important;
        border-radius: 8px;
        animation: kg-spotlight-glow 2.5s infinite ease-in-out;
        pointer-events: auto !important;
      }

      @keyframes kg-spotlight-glow {
        0% { box-shadow: 0 0 15px rgba(212, 175, 55, 0.4); }
        50% { box-shadow: 0 0 25px rgba(212, 175, 55, 0.7); }
        100% { box-shadow: 0 0 15px rgba(212, 175, 55, 0.4); }
      }

      .kg-onboard-card {
        position: fixed;
        z-index: 10000;
        background: #14141f;
        border: 1px solid #d4af37;
        border-radius: 12px;
        padding: 18px 22px;
        width: 320px;
        max-width: calc(100vw - 24px);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.7);
        color: #f0f0f5;
        font-family: system-ui, -apple-system, sans-serif;
        transition: top 0.3s cubic-bezier(0.16, 1, 0.3, 1), left 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto !important;
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

      /* ---- Responsive: tablet ---- */
      @media (max-width: 768px) {
        .kg-onboard-card {
          width: 280px;
          padding: 16px 18px;
        }
        .kg-onboard-card h4 { font-size: 1rem; }
        .kg-onboard-card p { font-size: 0.88rem; }
      }

      /* ---- Responsive: phones ---- */
      @media (max-width: 480px) {
        .kg-onboard-card {
          left: 12px !important;
          right: 12px;
          width: auto !important;
          max-width: none;
          padding: 14px 16px;
        }
        .kg-onboard-card h4 { font-size: 0.98rem; margin-bottom: 6px; }
        .kg-onboard-card p { font-size: 0.85rem; margin-bottom: 12px; line-height: 1.45; }
        .kg-onboard-action-btn { padding: 8px 16px; font-size: 0.9rem; }
        .kg-onboard-spotlight { outline-width: 1.5px; }
      }
    `;
    document.head.appendChild(style);
  }

  // Safe DOM finder — never throws even if a selector is malformed
  function getElement(selectorString) {
    const selectors = selectorString.split(',');
    for (let selector of selectors) {
      selector = selector.trim();
      if (!selector) continue;
      try {
        const el = document.querySelector(selector);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
          return el;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  function clearHighlight() {
    if (currentHighlightedEl) {
      currentHighlightedEl.classList.remove('kg-onboard-spotlight');
      currentHighlightedEl = null;
    }
  }

  function showGuidedTip(milestone, customNextCallback = null) {
    if (localStorage.getItem(storagePrefix + milestone.id) === 'true') {
      return false;
    }

    const targetEl = getElement(milestone.target);
    if (!targetEl) return false;

    injectStyles();

    if (!activeBackdrop) {
      activeBackdrop = document.createElement('div');
      activeBackdrop.className = 'kg-onboard-vignette';
      document.body.appendChild(activeBackdrop);
    }

    clearHighlight();

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

    targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' });

    setTimeout(() => {
      const rect = targetEl.getBoundingClientRect();
      const tooltipRect = activeTooltip.getBoundingClientRect();

      let top = rect.bottom + window.scrollY + 12;
      let left = rect.left + window.scrollX;

      if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - tooltipRect.height - 12;
      }
      if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 20;
      }
      if (left < 12) left = 12;
      if (top < 12) top = 12;

      activeTooltip.style.top = `${top}px`;
      activeTooltip.style.left = `${left}px`;
    }, 150);

    document.getElementById('kg-onboard-ack').onclick = function () {
      localStorage.setItem(storagePrefix + milestone.id, 'true');
      dismissActiveTip();
      if (typeof customNextCallback === 'function') {
        customNextCallback();
      }
    };

    return true;
  }

  function dismissActiveTip() {
    clearHighlight();
    if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }
    if (activeBackdrop) { activeBackdrop.remove(); activeBackdrop = null; }
  }

  function resetMilestones(group) {
    Object.keys(group).forEach((key) => {
      localStorage.removeItem(storagePrefix + group[key].id);
    });
  }

  // ---- Quest Board sequence: welcome -> coins -> post -> (on-demand: manage, nav) ----
  function runQuestBoardSequence() {
    setTimeout(() => {
      showGuidedTip(questBoardMilestones.welcome, () => {
        setTimeout(() => {
          showGuidedTip(questBoardMilestones.coins, () => {
            setTimeout(() => {
              showGuidedTip(questBoardMilestones.postBtn);
            }, 500);
          });
        }, 500);
      });
    }, 1000);

    // "My Posted" tab -> explain manage/edit/delete
    document.body.addEventListener('click', (e) => {
      if (e.target.closest('#view-posted')) {
        setTimeout(() => showGuidedTip(questBoardMilestones.manageQuests), 400);
      }
    });

    // Floating nav -> explain navigation, once
    const navEl = getElement('#kg-floating-nav');
    if (navEl) {
      const triggerNavTip = () => {
        if (showGuidedTip(questBoardMilestones.navigation)) {
          navEl.removeEventListener('mouseenter', triggerNavTip);
        }
      };
      navEl.addEventListener('mouseenter', triggerNavTip);
    }
  }

  // ---- Quest Post page: explain the form once ----
  function runQuestPostSequence() {
    setTimeout(() => {
      showGuidedTip(questPostMilestones.postForm);
    }, 800);
  }

  // ---- Feature Tour pages: a single intro tip, shown once on first visit ----
  function runSingleTipPage(milestone) {
    setTimeout(() => {
      showGuidedTip(milestone);
    }, 800);
  }

  function initAutomatedTriggers() {
    dismissActiveTip();
    if (path === 'quest-board.html' || path === '') {
      runQuestBoardSequence();
    } else if (path === 'quest-post.html') {
      runQuestPostSequence();
    } else if (path === 'fairy-wishes.html') {
      runSingleTipPage(fairyWishesMilestones.wishesIntro);
    } else if (path === 'worker-post.html') {
      runSingleTipPage(workerPostMilestones.workersIntro);
    } else if (path === 'undo-history.html') {
      runSingleTipPage(undoHistoryMilestones.undoIntro);
    } else if (path === 'profile.html') {
      runSingleTipPage(profileMilestones.profileIntro);
    }
  }

  // Manual re-trigger, e.g. from the Guide button
  window.showOnboarding = function (forceStart = false) {
    if (forceStart) {
      allMilestoneGroups.forEach(resetMilestones);
    }
    initAutomatedTriggers();
  };

  function boot() {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get('startGuide') === '1';
    if (forced) {
      allMilestoneGroups.forEach(resetMilestones);
      const url = new URL(window.location.href);
      url.searchParams.delete('startGuide');
      window.history.replaceState({}, '', url);
    }
    initAutomatedTriggers();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
