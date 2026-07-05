// ============================================
// KINDRED GUILD — ONBOARDING & WALKTHROUGH
// ============================================
const SUPABASE_URL = 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cHlxZXVibWZ2dHVxamF4YXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTYxODQsImV4cCI6MjA5NTI5MjE4NH0.9lQ8jxTgiCdhjC8VeYAuU3EI7UzvwHiwuGIuwyxMGLM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let onboardingStep = 0;
let onboardingActive = false;

const onboardingSteps = [
  {
    title: '🎭 Welcome to Kindred Guild',
    description: 'A community where help flows freely. No middlemen. No corporate gatekeeping. Just mutual aid.',
    emotionalMessage: 'You\'re not alone. Together, we build something real.',
    target: null,
    position: 'center'
  },
  {
    title: '📋 The Quest Board',
    description: 'Browse tasks people need help with. From coding to design, from mentorship to moving help. Real work. Real impact.',
    emotionalMessage: 'Every quest is someone\'s need. Every completion is someone\'s relief.',
    target: '#questGrid',
    position: 'bottom'
  },
  {
    title: '🪙 Fairy Coins: Your Guild Currency',
    description: 'Earn coins by helping others. Spend coins to get help. No bank fees. No corporate profit. Just community.',
    emotionalMessage: 'Coins represent trust. The more you help, the more you earn. The more you earn, the more you can give.',
    target: '#coinBalance',
    position: 'bottom'
  },
  {
    title: '🤝 How It Works',
    description: 'Post a quest → Workers apply → You collaborate → Payment releases → Ratings build trust',
    emotionalMessage: 'This is how communities have worked for centuries. We\'re just making it digital.',
    target: null,
    position: 'center'
  },
  {
    title: '🛡️ Safety & Trust',
    description: 'Coins are held in escrow. Disputes are resolved fairly. Ratings are anonymous. Your data is yours.',
    emotionalMessage: 'Trust is earned, not assumed. We protect both sides.',
    target: null,
    position: 'center'
  },
  {
    title: '✨ You\'re Ready',
    description: 'Browse quests, post your needs, or offer your skills. The guild is yours to shape.',
    emotionalMessage: 'Welcome home, adventurer.',
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
    }, 500);
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
    background: rgba(0, 0, 0, 0.7);
    z-index: 9998;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modal = document.createElement('div');
  modal.id = 'onboardingModal';
  modal.style.cssText = `
    background: linear-gradient(135deg, #1e1e2c 0%, #2a2a3e 100%);
    border: 2px solid #c9a84c;
    border-radius: 12px;
    padding: 40px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(201, 168, 76, 0.2);
    font-family: 'Segoe UI', sans-serif;
    color: #e1e1e9;
    z-index: 9999;
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  return { overlay, modal };
}

function showOnboarding() {
  if (onboardingActive) return;
  onboardingActive = true;
  onboardingStep = 0;

  const { overlay, modal } = createOnboardingOverlay();

  function updateStep() {
    const step = onboardingSteps[onboardingStep];
    
    modal.innerHTML = `
      <div style="text-align: center;">
        <h2 style="font-size: 1.8rem; color: #c9a84c; margin-bottom: 16px;">${step.title}</h2>
        <p style="font-size: 1rem; color: #9494a8; margin-bottom: 16px; line-height: 1.6;">${step.description}</p>
        <blockquote style="
          font-style: italic;
          color: #c9a84c;
          border-left: 3px solid #c9a84c;
          padding-left: 16px;
          margin: 24px 0;
          font-size: 0.95rem;
        ">
          "${step.emotionalMessage}"
        </blockquote>
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
          ${onboardingStep > 0 ? `
            <button onclick="window.OnboardingController.previousStep()" style="
              padding: 10px 20px;
              background: transparent;
              color: #c9a84c;
              border: 1px solid #c9a84c;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            ">← Back</button>
          ` : ''}
          ${onboardingStep < onboardingSteps.length - 1 ? `
            <button onclick="window.OnboardingController.nextStep()" style="
              padding: 10px 20px;
              background: #c9a84c;
              color: #000;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            ">Next →</button>
          ` : `
            <button onclick="window.OnboardingController.completeOnboarding()" style="
              padding: 10px 20px;
              background: #10b981;
              color: #fff;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            ">Let's Begin ✨</button>
          `}
          <button onclick="window.OnboardingController.skipOnboarding()" style="
            padding: 10px 20px;
            background: transparent;
            color: #9494a8;
            border: 1px solid #9494a8;
            border-radius: 4px;
            cursor: pointer;
          ">Skip</button>
        </div>
        <div style="margin-top: 20px; font-size: 0.8rem; color: #5a5a6a;">
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
      onboardingActive = false;
    },
    skipOnboarding() {
      overlay.remove();
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
    console.error('Error marking onboarding complete:', error);
  }
}

window.showOnboarding = showOnboarding;
window.markOnboardingComplete = markOnboardingComplete;
