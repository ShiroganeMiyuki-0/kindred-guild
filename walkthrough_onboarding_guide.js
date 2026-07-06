// ============================================
// KINDRED GUILD — PREMIUM ONBOARDING & GAME-STYLE WALKTHROUGH
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let onboardingStep = 0;
let onboardingActive = false;

const onboardingSteps = [
  {
    title: '⚔️ Enter the Kindred Guild',
    description: 'Welcome, Traveler. This is not another cold, transactional gig marketplace. This is a sovereign fellowship of mutual aid. Here, we match real needs with trusted skills, protected by ancestral honor and modern ledger security.',
    emotionalMessage: 'In this hall, your labor is valued, your agreements are secure, and your achievements build genuine community honor.',
    target: null,
    position: 'center'
  },
  {
    title: '📜 The Quest Board',
    description: 'This is where community needs are formalized. Members post "Quests" ranging from technical crafting to real-world assistance. You can browse active quests, filter them by type, and accept missions that align with your build.',
    emotionalMessage: 'Behind every quest card is a real human seeking coordination. Every completion is a pledge fulfilled.',
    target: '#questGrid',
    position: 'bottom'
  },
  {
    title: '🪙 Fairy Coins: Tokens of Trust',
    description: 'Our ecosystem operates on Fairy Coins (FC)—a non-speculative, ledger-verified utility credit. You earn coins by completing quests and spend them to summon help. They are protected upfront in sovereign guild escrow.',
    emotionalMessage: 'Fairy Coins are physical-digital proof of mutual reciprocity. The more you give, the more you are empowered to receive.',
    target: '#coinBalance',
    position: 'bottom'
  },
  {
    title: '🛡️ Sovereign Safety Escrow',
    description: 'To protect our fellowship, financial quests have their values locked securely in escrow upon posting. Workers can proceed with absolute confidence that their rewards are verified and guaranteed.',
    emotionalMessage: 'We guard your energy. No unpaid exploitation, no platform middleman, just pure structural safety.',
    target: '.filters-section',
    position: 'bottom'
  },
  {
    title: '🕊️ Absolute Reversibility',
    description: 'People make mistakes, and plans shift. That is why the Guild provides a 24-hour grace window. You can edit your posted quests, adjust reward appraisal values, or undo deletions instantly from your history registry.',
    emotionalMessage: 'A resilient community values grace over rigidity. We design for human reality.',
    target: null,
    position: 'center'
  },
  {
    title: '✨ Cast Your First Chronicle',
    description: 'You are now an authorized member of the enclave. You can post quests, offer your services as an Adventurer for Hire, or vote on community Wishes.',
    emotionalMessage: 'Your journey begins. Go forth and make the guild proud, adventurer.',
    target: null,
    position: 'center'
  }
];

(async function init() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return;
  }
  currentUser = user;

  const { data: profile } = await sb
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single();

  if (!profile?.onboarding_completed) {
    setTimeout(() => {
      showOnboarding();
    }, 1200);
  }
})();

function createOnboardingOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'onboardingOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(4, 4, 6, 0.9);
    z-index: 9998;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    transition: all 0.3s ease;
  `;

  const modal = document.createElement('div');
  modal.id = 'onboardingModal';
  modal.style.cssText = `
    background: linear-gradient(135deg, #14141e 0%, #1e1e2d 100%);
    border: 2px solid #d4af37;
    border-radius: 16px;
    padding: 36px;
    max-width: 520px;
    width: 90%;
    box-shadow: 0 25px 50px -12px rgba(212, 175, 55, 0.25);
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #f0f0f5;
    z-index: 9999;
    position: relative;
    transform: translateY(0);
    transition: transform 0.3s ease;
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  return { overlay, modal };
}

function showOnboarding(forceRestart = false) {
  if (onboardingActive && !forceRestart) return;
  document.getElementById('onboardingOverlay')?.remove();
  document.querySelectorAll('.onboarding-highlight').forEach(el => el.classList.remove('onboarding-highlight'));
  onboardingActive = true;
  onboardingStep = 0;

  const { overlay, modal } = createOnboardingOverlay();

  function updateStep() {
    const step = onboardingSteps[onboardingStep];
    document.querySelectorAll('.onboarding-highlight').forEach(el => el.classList.remove('onboarding-highlight'));
    
    if (step.target) {
      const target = document.querySelector(step.target);
      if (target) {
        target.classList.add('onboarding-highlight');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    modal.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 2.5rem; margin-bottom: 12px; animation: pulse 2s infinite;">✨</div>
        <h2 style="font-family: 'Cinzel', 'Georgia', serif; font-size: 1.6rem; color: #d4af37; margin-bottom: 16px; letter-spacing: 1px;">${step.title}</h2>
        <p style="font-size: 0.95rem; color: #9494a8; margin-bottom: 20px; line-height: 1.7; text-align: left;">${step.description}</p>
        <blockquote style="
          font-style: italic;
          color: #d4af37;
          border-left: 3px solid #d4af37;
          padding-left: 16px;
          margin: 24px 0;
          font-size: 0.9rem;
          text-align: left;
          background: rgba(212, 175, 55, 0.05);
          padding: 12px 16px;
          border-radius: 0 8px 8px 0;
        ">
          "${step.emotionalMessage}"
        </blockquote>
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 24px; flex-wrap: wrap;">
          ${onboardingStep > 0 ? `
            <button onclick="window.OnboardingController.previousStep()" style="
              padding: 12px 24px;
              background: transparent;
              color: #d4af37;
              border: 1px solid #d4af37;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
              font-size: 0.9rem;
              transition: all 0.2s;
            ">← Back</button>
          ` : ''}
          ${onboardingStep < onboardingSteps.length - 1 ? `
            <button onclick="window.OnboardingController.nextStep()" style="
              padding: 12px 24px;
              background: #d4af37;
              color: #0c0c0f;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
              font-size: 0.9rem;
              transition: all 0.2s;
              box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
            ">Continue Quest →</button>
          ` : `
            <button onclick="window.OnboardingController.completeOnboarding()" style="
              padding: 12px 24px;
              background: #10b981;
              color: #fff;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: bold;
              font-size: 0.9rem;
              transition: all 0.2s;
              box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            ">Enter Fellowship ✨</button>
          `}
          <button onclick="window.OnboardingController.skipOnboarding()" style="
            padding: 12px 24px;
            background: rgba(148, 148, 168, 0.1);
            color: #9494a8;
            border: 1px solid rgba(148, 148, 168, 0.2);
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s;
          ">Skip Intro</button>
        </div>
        <div style="margin-top: 20px; font-size: 0.75rem; color: #5a5a6a; letter-spacing: 1px; text-transform: uppercase;">
          Step ${onboardingStep + 1} of ${onboardingSteps.length}
        </div>
      </div>
    `;
  }

  updateStep();

  window.OnboardingController = {
    nextStep() {
      if (onboardingStep < onboardingSteps.length - 1) {
        onboardingStep++;
        updateStep();
      }
    },
    previousStep() {
      if (onboardingStep > 0) {
        onboardingStep--;
        updateStep();
      }
    },
    completeOnboarding() {
      markOnboardingComplete();
      overlay.remove();
      document.querySelectorAll('.onboarding-highlight').forEach(el => el.classList.remove('onboarding-highlight'));
      onboardingActive = false;
    },
    skipOnboarding() {
      overlay.remove();
      document.querySelectorAll('.onboarding-highlight').forEach(el => el.classList.remove('onboarding-highlight'));
      onboardingActive = false;
    }
  };
}

async function markOnboardingComplete() {
  if (!currentUser) return;

  const { error } = await sb
    .from('user_profiles')
    .update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString()
    })
    .eq('user_id', currentUser.id);

  if (error) {
    console.error('Error recording onboarding status:', error);
  }
}

window.showOnboarding = showOnboarding;
window.markOnboardingComplete = markOnboardingComplete;

const onboardingStyle = document.createElement('style');
onboardingStyle.textContent = `
  .onboarding-highlight {
    position: relative;
    z-index: 9999 !important;
    outline: 3px solid #d4af37 !important;
    box-shadow: 0 0 0 9999px rgba(4, 4, 6, 0.85), 0 0 35px rgba(212, 175, 55, 0.65) !important;
    border-radius: 12px;
    background: #14141e !important;
  }
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
`;
document.head.appendChild(onboardingStyle);