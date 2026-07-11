/**
 * Kindred Guild - Context-Aware, Automated Onboarding Walkthrough
 * Copyright (c) 2026 Kindred Guild. All Rights Reserved.
 * Unauthorized copying or redistribution is prohibited.
 * Updated: 2026-07-10 — Added guides for all new features.
 *
 * Automatically triggers non-blocking guide tips the first time a user
 * lands on a page. Also triggerable manually via the "Guide" button.
 */
(function () {
  const storagePrefix = 'kg_tip_';
  let activeTooltip = null;
  let activeBackdrop = null;
  let currentHighlightedEl = null;

  const path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  // ── Quest Board ──
  const questBoardMilestones = {
    welcome: { id: 'welcome', target: '.container, main, body', title: '⚔️ Welcome to the Quest Board!', intro: 'This is where tasks are posted. Browse available quests, accept one, and earn Fairy Coins by completing it. Or post your own task and get help!' },
    coins: { id: 'coins', target: '#coinBalanceContainer, #coinBalance', title: '🪙 Your Coin Pouch', intro: 'Fairy Coins (FC) are the internal currency. Earn them by completing tasks, spend them to post paid tasks. Buy more via UPI if needed.' },
    postBtn: { id: 'postBtn', target: 'a[href="quest-post.html"]', title: '📜 Post a Task', intro: 'Click here to post a new task. Choose from 8 quick templates, set a reward (coins, UPI, or free), and a deadline.' },
    bookmarkTab: { id: 'bookmarkTab', target: '#view-bookmarked', title: '🔖 Bookmarks', intro: 'Save quests you\'re interested in with the bookmark button. They\'ll appear here so you can find them later.' },
    filters: { id: 'filters', target: '.filter-bar, #filterType', title: '🔍 Filters & Search', intro: 'Filter by payment type (coins/UPI/free), sort by deadline or pay, and search by title or tags. Use tag badges to filter by skill.' }
  };

  // ── Quest Post ──
  const questPostMilestones = {
    templates: { id: 'templates', target: '.card:has(button[onclick*="applyTemplate"]), h3:has(+ div > button[onclick*="applyTemplate"])', title: '📋 Quick Templates', intro: 'Pick a template to pre-fill your task! Choose from Logo Design, Website, Content Writing, Data Entry, Social Media, Tutoring, Errand, or Bug Fix. Edit the pre-filled text to match your needs.' },
    form: { id: 'form', target: '#questForm', title: '✍️ Post Your Task', intro: 'Set a title, description, tags, payment type, reward, and deadline. The 10% fee is locked upfront alongside your reward. Hit Post Task when ready!' }
  };

  // ── Fairy Wishes ──
  const fairyWishesMilestones = {
    wishesIntro: { id: 'wishesIntro', target: '.wish-filters, #wishesFeed', title: '✨ Fairy Wishes Board', intro: 'Vote on what the Guild should build next. Click "Back This Wish" to support with Fairy Coins, UPI, or just a free vote. Backed wishes get priority attention!' },
    makeWish: { id: 'makeWish', target: '.side-card, #wishForm', title: '🪄 Make a Wish', intro: 'Submit your own wish here. Choose a pledge type — free voting, or back it with coins/UPI to give it more weight. The admin reviews top-voted wishes.' }
  };

  // ── Guild Hall ──
  const guildHallMilestones = {
    channels: { id: 'channels', target: '.channel-sidebar, #channelSidebar', title: '🏰 Guild Hall Channels', intro: 'Welcome to the Guild Hall! Switch between channels on the left. Each channel is a different topic — general chat, quest help, introductions, or announcements.' },
    chat: { id: 'chat', target: '.chat-area, #chatMessages', title: '💬 Realtime Chat', intro: 'Messages appear in real-time. Type a message and hit Send. Admins can pin important messages and delete inappropriate ones.' },
    search: { id: 'ghSearch', target: '#msgSearchInput', title: '🔍 Search Messages', intro: 'Use this search box to filter messages in the current channel. Great for finding old conversations.' }
  };

  // ── Leaderboard ──
  const leaderboardMilestones = {
    intro: { id: 'lbIntro', target: '.sort-tabs, .leaderboard-list', title: '🏆 Leaderboard', intro: 'See who\'s contributing the most! Sort by reputation, completed quests, coins earned, tasks posted, or overall activity. Top 3 get medals.' }
  };

  // ── Activity Feed ──
  const activityMilestones = {
    intro: { id: 'actIntro', target: '.activity-list, #activityList', title: '📰 Activity Feed', intro: 'See recent activity across the platform — quests posted, wishes created, users joining, disputes filed. Use "Load More" to see older events.' }
  };

  // ── Notifications ──
  const notificationsMilestones = {
    intro: { id: 'notifIntro', target: '.notif-list, #notifList', title: '🔔 Notifications', intro: 'Your notifications appear here. Quest accepted, wish backed, admin warnings, dispute updates — all in one place. Mark all as read when you\'re caught up.' }
  };

  // ── Coin Ledger ──
  const coinLedgerMilestones = {
    intro: { id: 'ledgerIntro', target: '.balance-card, #ledgerBody', title: '💰 Coin Ledger', intro: 'Your complete transaction history. See where your coins came from (quest earnings, referrals) and where they went (commissions, backings, quest rewards). Your current balance is always shown at the top.' }
  };

  // ── Worker Posts ──
  const workerPostMilestones = {
    form: { id: 'workerForm', target: '.post-form, #workerTitle', title: '🛡️ Post Your Availability', intro: 'List yourself as a worker! Add a title, description, tags (like #design, #coding), preferred payment type, and minimum reward. Quest posters can find and hire you.' },
    search: { id: 'workerSearch', target: '#workerSearchInput, #workerPaymentFilter', title: '🔍 Find Workers', intro: 'Search workers by name, skill, or tag. Filter by payment type to find workers that match your needs.' }
  };

  // ── Referral ──
  const referralMilestones = {
    intro: { id: 'refIntro', target: '.hero-card, .code-display', title: '🎁 Refer & Earn', intro: 'Share your unique referral code with friends! When they sign up using your code, you track your referrals here. Share via WhatsApp, Twitter, or Telegram.' }
  };

  // ── Profile ──
  const profileMilestones = {
    intro: { id: 'profileIntro', target: '.profile-card, .meta-details', title: '🪪 Your Guild Profile', intro: 'Your profile shows your reputation, stats (quests completed, wishes backed, guild messages), and coin balance. Edit your display name, avatar, and UPI settings in the Settings tab.' },
    stats: { id: 'profileStats', target: '#statCompleted, .stats-grid, [id^="stat"]', title: '📊 Your Stats', intro: 'Track your contributions: quests completed, tasks posted, wishes backed, guild messages sent, total coins earned, and average rating.' }
  };

  // ── All groups ──
  const allMilestoneGroups = [
    questBoardMilestones, questPostMilestones, fairyWishesMilestones,
    guildHallMilestones, leaderboardMilestones, activityMilestones,
    notificationsMilestones, coinLedgerMilestones, workerPostMilestones,
    referralMilestones, profileMilestones
  ];

  // ── Styles ──
  function injectStyles() {
    if (document.getElementById('kg-advanced-onboard-styles')) return;
    const style = document.createElement('style');
    style.id = 'kg-advanced-onboard-styles';
    style.textContent = `
      .kg-onboard-vignette { position:fixed;top:0;left:0;width:100vw;height:100vh;background:radial-gradient(circle,rgba(14,14,22,0.2) 40%,rgba(8,8,12,0.65) 100%);z-index:1000;pointer-events:none!important;transition:opacity 0.4s ease; }
      .kg-onboard-spotlight { position:relative!important;z-index:1001!important;outline:2px solid #d4af37!important;box-shadow:0 0 20px rgba(212,175,55,0.5),inset 0 0 10px rgba(212,175,55,0.2)!important;border-radius:8px;animation:kg-spotlight-glow 2.5s infinite ease-in-out;pointer-events:auto!important; }
      @keyframes kg-spotlight-glow { 0%{box-shadow:0 0 15px rgba(212,175,55,0.4)} 50%{box-shadow:0 0 25px rgba(212,175,55,0.7)} 100%{box-shadow:0 0 15px rgba(212,175,55,0.4)} }
      .kg-onboard-card { position:fixed;z-index:1002;background:#14141f;border:1px solid #d4af37;border-radius:12px;padding:18px 22px;width:320px;max-width:calc(100vw - 24px);box-shadow:0 12px 30px rgba(0,0,0,0.7);color:#f0f0f5;font-family:system-ui,-apple-system,sans-serif;transition:top 0.3s cubic-bezier(0.16,1,0.3,1),left 0.3s cubic-bezier(0.16,1,0.3,1);pointer-events:auto!important; }
      .kg-onboard-card h4 { margin:0 0 8px 0;font-size:1.1rem;color:#e5c158;border-bottom:1px solid rgba(212,175,55,0.15);padding-bottom:6px;font-weight:700; }
      .kg-onboard-card p { margin:0 0 16px 0;font-size:0.92rem;line-height:1.5;color:#ccd0df; }
      .kg-onboard-footer { display:flex;justify-content:space-between;align-items:center; }
      .kg-onboard-progress { font-size:0.78rem;color:#8c8ca5;font-weight:500; }
      .kg-onboard-action-btn { background:#d4af37;border:1px solid #d4af37;color:#0e0e15;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:0.85rem;font-weight:700;transition:all 0.2s ease; }
      .kg-onboard-action-btn:hover { background:#f1cc64;border-color:#f1cc64; }
      @media(max-width:768px){.kg-onboard-card{width:280px;padding:16px 18px}.kg-onboard-card h4{font-size:1rem}.kg-onboard-card p{font-size:0.88rem}}
      @media(max-width:480px){.kg-onboard-card{left:12px!important;right:12px;width:auto!important;max-width:none;padding:14px 16px}.kg-onboard-card h4{font-size:0.98rem;margin-bottom:6px}.kg-onboard-card p{font-size:0.85rem;margin-bottom:12px;line-height:1.45}.kg-onboard-action-btn{padding:8px 16px;font-size:0.9rem}.kg-onboard-spotlight{outline-width:1.5px}}
    `;
    document.head.appendChild(style);
  }

  function getElement(selectorString) {
    const selectors = selectorString.split(',');
    for (let selector of selectors) {
      selector = selector.trim();
      if (!selector) continue;
      try {
        const el = document.querySelector(selector);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
      } catch (e) { continue; }
    }
    return null;
  }

  function clearHighlight() {
    if (currentHighlightedEl) { currentHighlightedEl.classList.remove('kg-onboard-spotlight'); currentHighlightedEl = null; }
  }

  function showGuidedTip(milestone, customNextCallback) {
    if (localStorage.getItem(storagePrefix + milestone.id) === 'true') return false;
    const targetEl = getElement(milestone.target);
    if (!targetEl) return false;
    injectStyles();

    if (!activeBackdrop) { activeBackdrop = document.createElement('div'); activeBackdrop.className = 'kg-onboard-vignette'; document.body.appendChild(activeBackdrop); }
    clearHighlight();
    if (!activeTooltip) { activeTooltip = document.createElement('div'); activeTooltip.className = 'kg-onboard-card'; document.body.appendChild(activeTooltip); }

    targetEl.classList.add('kg-onboard-spotlight');
    currentHighlightedEl = targetEl;

    activeTooltip.innerHTML = `<h4>${milestone.title}</h4><p>${milestone.intro}</p><div class="kg-onboard-footer"><span class="kg-onboard-progress">Guild Assistant</span><button class="kg-onboard-action-btn" id="kg-onboard-ack">Got it!</button></div>`;
    targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' });

    setTimeout(() => {
      const rect = targetEl.getBoundingClientRect();
      const tooltipRect = activeTooltip.getBoundingClientRect();
      let top = rect.bottom + window.scrollY + 12, left = rect.left + window.scrollX;
      if (top + tooltipRect.height > window.innerHeight + window.scrollY) top = rect.top + window.scrollY - tooltipRect.height - 12;
      if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 20;
      if (left < 12) left = 12;
      if (top < 12) top = 12;
      activeTooltip.style.top = `${top}px`;
      activeTooltip.style.left = `${left}px`;
    }, 150);

    document.getElementById('kg-onboard-ack').onclick = function () {
      localStorage.setItem(storagePrefix + milestone.id, 'true');
      dismissActiveTip();
      if (typeof customNextCallback === 'function') customNextCallback();
    };
    return true;
  }

  function dismissActiveTip() {
    clearHighlight();
    if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; }
    if (activeBackdrop) { activeBackdrop.remove(); activeBackdrop = null; }
  }

  function resetMilestones(group) { Object.keys(group).forEach(k => localStorage.removeItem(storagePrefix + group[k].id)); }

  // ── Sequences ──
  function runQuestBoardSequence() {
    setTimeout(() => showGuidedTip(questBoardMilestones.welcome, () => {
      setTimeout(() => showGuidedTip(questBoardMilestones.coins, () => {
        setTimeout(() => showGuidedTip(questBoardMilestones.postBtn, () => {
          setTimeout(() => showGuidedTip(questBoardMilestones.bookmarkTab, () => {
            setTimeout(() => showGuidedTip(questBoardMilestones.filters));
          }), 500);
        }), 500);
      }), 500);
    }), 1000);
  }

  function runQuestPostSequence() {
    setTimeout(() => showGuidedTip(questPostMilestones.templates, () => {
      setTimeout(() => showGuidedTip(questPostMilestones.form));
    }), 800);
  }

  function runSingleTipPage(milestone) { setTimeout(() => showGuidedTip(milestone), 800); }

  function runSequence(tips) {
    let i = 0;
    function next() { if (i < tips.length) { setTimeout(() => showGuidedTip(tips[i++], next), 500); } }
    setTimeout(() => { showGuidedTip(tips[i++], next); }, 800);
  }

  function initAutomatedTriggers() {
    dismissActiveTip();
    if (path === 'quest-board.html' || path === '') runQuestBoardSequence();
    else if (path === 'quest-post.html') runQuestPostSequence();
    else if (path === 'fairy-wishes.html') runSequence([fairyWishesMilestones.wishesIntro, fairyWishesMilestones.makeWish]);
    else if (path === 'guild-hall.html') runSequence([guildHallMilestones.channels, guildHallMilestones.chat, guildHallMilestones.search]);
    else if (path === 'leaderboard.html') runSingleTipPage(leaderboardMilestones.intro);
    else if (path === 'activity.html') runSingleTipPage(activityMilestones.intro);
    else if (path === 'notifications.html') runSingleTipPage(notificationsMilestones.intro);
    else if (path === 'coin-ledger.html') runSingleTipPage(coinLedgerMilestones.intro);
    else if (path === 'worker-post.html') runSequence([workerPostMilestones.form, workerPostMilestones.search]);
    else if (path === 'referral.html') runSingleTipPage(referralMilestones.intro);
    else if (path === 'profile.html') runSequence([profileMilestones.intro, profileMilestones.stats]);
  }

  window.showOnboarding = function (forceStart) {
    if (forceStart) allMilestoneGroups.forEach(resetMilestones);
    initAutomatedTriggers();
  };

  function boot() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('startGuide') === '1') {
      allMilestoneGroups.forEach(resetMilestones);
      const url = new URL(window.location.href);
      url.searchParams.delete('startGuide');
      window.history.replaceState({}, '', url);
    }
    initAutomatedTriggers();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
