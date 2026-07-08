// ============================================
// KINDRED GUILD — ONBOARDING WALKTHROUGH
// Loads on quest-board.html for first-time users.
// ============================================
(function () {
  if (!window.sb) return; // supabase-client.js must be loaded first

  let currentUser = null;
  let step = 0;
  let active = false;

  const steps = [
    {
      icon: '⚔️',
      title: 'Welcome to Kindred Guild',
      text: "This is a community board where people post tasks and others help them out. Think of it like a local bulletin board — but with protections built in.",
      emotion: "You're joining a community that values trust and mutual help.",
      target: null
    },
    {
      icon: '📜',
      title: 'The Quest Board',
      text: "Every card here is a real task posted by a community member. Browse them, filter by type, and click one to see details. If you see something you can help with — accept it.",
      emotion: 'Behind every task is someone who needs help. Behind every completion is a promise kept.',
      target: '#questGrid'
    },
    {
      icon: '🪙',
      title: 'Fairy Coins',
      text: "Our internal currency. You earn coins by completing paid tasks, and spend them to post your own. Coins are locked in escrow when a task is posted — so workers know the money is real.",
      emotion: "Think of it as community trust made tangible.",
      target: '#coinBalance'
    },
    {
      icon: '🛡️',
      title: 'Your Protection',
      text: "Payments are locked upfront. Workers can't be scammed — the coins are already there. Posters can request revisions or cancel if work isn't done. Both sides rate each other after completion.",
      emotion: "We built this so neither side gets burned.",
      target: '.filters-section'
    },
    {
      icon: '🔄',
      title: 'You Can Change Your Mind',
      text: "Made a mistake? You can edit your tasks, change the reward, switch between free and paid, or cancel entirely. Actions aren't permanent here.",
      emotion: "We all make mistakes. The system accounts for that.",
      target: null
    },
    {
      icon: '✨',
      title: "You're Ready",
      text: "Post a task, accept one, or just browse. You can also offer your skills as an adventurer — post what you can do and get hired.",
      emotion: "Welcome aboard. The guild is better with you here.",
      target: null
    }
  ];

  async function init() {
    try {
      const { data: { user } } = await window.sb.auth.getUser();
      if (!user) return;
      currentUser = user;

      const { data: profile } = await window.sb
        .from('user_profiles')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .single();

      if (!profile?.onboarding_completed) {
        setTimeout(() => show(), 1000);
      }
    } catch (e) {
      // Silent fail — don't break the page
    }
  }

  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'kg-onboarding-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(4,4,6,0.92);
      z-index: 9998; display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(4px);
    `;
    const modal = document.createElement('div');
    modal.id = 'kg-onboarding-modal';
    modal.style.cssText = `
      background: linear-gradient(135deg, #14141e, #1e1e2d);
      border: 2px solid #d4af37; border-radius: 16px;
      padding: 32px; max-width: 480px; width: 90%;
      box-shadow: 0 25px 50px rgba(212,175,55,0.2);
      font-family: 'Segoe UI', system-ui, sans-serif; color: #f0f0f5;
      z-index: 9999; position: relative;
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    return { overlay, modal };
  }

  function show(forceRestart) {
    if (active && !forceRestart) return;
    document.getElementById('kg-onboarding-overlay')?.remove();
    document.querySelectorAll('.kg-onboard-highlight').forEach(el => el.classList.remove('kg-onboard-highlight'));
    active = true;
    step = 0;

    const { overlay, modal } = createOverlay();

    function render() {
      const s = steps[step];
      document.querySelectorAll('.kg-onboard-highlight').forEach(el => el.classList.remove('kg-onboard-highlight'));

      if (s.target) {
        const el = document.querySelector(s.target);
        if (el) {
          el.classList.add('kg-onboard-highlight');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      modal.innerHTML = `
        <div style="text-align:center">
          <div style="font-size:2.2rem;margin-bottom:8px">${s.icon}</div>
          <h2 style="font-family:'Cinzel',serif;font-size:1.4rem;color:#d4af37;margin-bottom:12px;letter-spacing:1px">${s.title}</h2>
          <p style="font-size:0.95rem;color:#b0b0c0;line-height:1.6;text-align:left;margin-bottom:16px">${s.text}</p>
          <blockquote style="font-style:italic;color:#d4af37;border-left:3px solid #d4af37;padding:10px 14px;margin:16px 0;font-size:0.85rem;text-align:left;background:rgba(212,175,55,0.04);border-radius:0 8px 8px 0">
            "${s.emotion}"
          </blockquote>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;flex-wrap:wrap">
            ${step > 0 ? `<button id="kg-ob-prev" style="padding:10px 20px;background:transparent;color:#d4af37;border:1px solid #d4af37;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem">← Back</button>` : ''}
            ${step < steps.length - 1
              ? `<button id="kg-ob-next" style="padding:10px 20px;background:#d4af37;color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem;box-shadow:0 4px 12px rgba(212,175,55,0.3)">Continue →</button>`
              : `<button id="kg-ob-done" style="padding:10px 20px;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem;box-shadow:0 4px 12px rgba(16,185,129,0.3)">Enter the Guild ✨</button>`
            }
            <button id="kg-ob-skip" style="padding:10px 20px;background:rgba(148,148,168,0.1);color:#9494a8;border:1px solid rgba(148,148,168,0.2);border-radius:8px;cursor:pointer;font-size:0.85rem">Skip</button>
          </div>
          <div style="margin-top:16px;font-size:0.7rem;color:#5a5a6a;letter-spacing:1px;text-transform:uppercase">
            Step ${step + 1} of ${steps.length}
          </div>
        </div>
      `;

      // Bind events
      const prevBtn = document.getElementById('kg-ob-prev');
      const nextBtn = document.getElementById('kg-ob-next');
      const doneBtn = document.getElementById('kg-ob-done');
      const skipBtn = document.getElementById('kg-ob-skip');

      if (prevBtn) prevBtn.onclick = () => { step--; render(); };
      if (nextBtn) nextBtn.onclick = () => { step++; render(); };
      if (doneBtn) doneBtn.onclick = () => complete(overlay);
      if (skipBtn) skipBtn.onclick = () => { overlay.remove(); active = false; };
    }

    render();
  }

  async function complete(overlay) {
    if (currentUser) {
      await window.sb
        .from('user_profiles')
        .update({ onboarding_completed: true, onboarding_completed_at: new Date().toISOString() })
        .eq('user_id', currentUser.id);
    }
    overlay.remove();
    document.querySelectorAll('.kg-onboard-highlight').forEach(el => el.classList.remove('kg-onboard-highlight'));
    active = false;
  }

  // Expose globally so quest-board "Guide" button can trigger it
  window.showOnboarding = (force) => show(force);

// Inject highlight style
  const style = document.createElement('style');
  style.textContent = `
    .kg-onboard-highlight {
      position: relative; z-index: 9999 !important;
      outline: 3px solid #d4af37 !important;
      box-shadow: 0 0 0 9999px rgba(4,4,6,0.85), 0 0 30px rgba(212,175,55,0.5) !important;
      border-radius: 12px; background: #14141e !important;
      pointer-events: none !important; /* Prevents accidental clicks and redirects during guide */
    }
  `;
  document.head.appendChild(style);
  
  // Auto-init on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
