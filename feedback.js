// feedback.js — works on any page
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";

const supabaseFeedback = window.supabase?.createClient
 ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function openFeedback() {
  document.getElementById('feedback-modal').style.display = 'flex';
}
function closeFeedback() {
  document.getElementById('feedback-modal').style.display = 'none';
}

async function submitFeedback() {
  const { data: { user } } = await supabaseFeedback.auth.getUser();
  if (!user) { alert('Please login first'); return; }

  const message = document.getElementById('fb-text').value.trim();
  const rating = document.getElementById('fb-rating').value;

  if (message.length < 4) { alert('Write a bit more'); return; }

  const { error } = await supabaseFeedback.from('feedback').insert({
    user_id: user.id,
    message,
    rating: rating? parseInt(rating) : null,
    page_url: location.pathname
  });

  if (error) alert('Error: ' + error.message);
  else {
    alert('Thanks for the feedback!');
    closeFeedback();
    document.getElementById('fb-text').value = '';
    document.getElementById('fb-rating').value = '';
  }
}

// attach button after page loads
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('feedback-fab')?.addEventListener('click', openFeedback);
});
