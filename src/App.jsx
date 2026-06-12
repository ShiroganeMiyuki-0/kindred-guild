import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import Auth from './components/Auth.jsx';
import QuestForm from './components/QuestForm.jsx';
import QuestCard from './components/QuestCard.jsx';
import Stats from './components/Stats.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // Fetch quests
    fetchQuests();

    return () => subscription.unsubscribe();
  }, []);

  const fetchQuests = async () => {
    try {
      const { data, error } = await supabase
        .from('quests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuests(data || []);
    } catch (err) {
      console.error('Error fetching quests:', err);
      setQuests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestCreated = (newQuest) => {
    setQuests([newQuest, ...quests]);
  };

  const handleAcceptQuest = async (questId) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('quests')
        .update({ status: 'accepted', accepted_by: user.id })
        .eq('id', questId);

      if (error) throw error;
      fetchQuests();
    } catch (err) {
      alert('Error accepting quest: ' + err.message);
    }
  };

  const handleCompleteQuest = async (questId) => {
    try {
      const { error } = await supabase
        .from('quests')
        .update({ status: 'completed' })
        .eq('id', questId);

      if (error) throw error;
      fetchQuests();
    } catch (err) {
      alert('Error completing quest: ' + err.message);
    }
  };

  const handlePayment = async (quest) => {
    if (!user) {
      alert('Please sign in to make a payment');
      return;
    }

    // For free tier: simulate payment confirmation
    // In production, this would integrate with Stripe Checkout
    const confirmed = confirm(
      `Confirm payment of $${quest.reward} for "${quest.title}"?\n\nGuild fee (${quest.fee}%): $${(quest.reward * quest.fee / 100).toFixed(2)}\nYou will receive: $${(quest.reward * (1 - quest.fee / 100)).toFixed(2)}`
    );

    if (confirmed) {
      try {
        const { error } = await supabase
          .from('quests')
          .update({ 
            payment_status: 'paid',
            paid_at: new Date().toISOString()
          })
          .eq('id', quest.id);

        if (error) throw error;
        alert('Payment successful! Quest completed.');
        fetchQuests();
      } catch (err) {
        alert('Payment error: ' + err.message);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <>
      <header className="hero">
        <div className="overlay"></div>
        <div className="hero-content container">
          <p className="tag">S-Rank Opportunity Network</p>
          <h1>Kindred Guild</h1>
          <p className="subtitle">
            A Fairy Tail-inspired guild where members post quests, bounties, and side-jobs. 
            Accept free missions or paid contracts—and let the guild earn a percentage from completed paid jobs.
          </p>
          <div className="hero-cta">
            <a href="#create" className="btn primary">Post a Quest</a>
            <a href="#quests" className="btn ghost">Browse Board</a>
            {user && (
              <button onClick={handleLogout} className="btn ghost" style={{ marginLeft: 'auto' }}>
                Sign Out ({user.email})
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container">
        {!user ? (
          <Auth onAuthSuccess={setUser} />
        ) : null}

        <Stats quests={quests} />

        {user && <QuestForm user={user} onQuestCreated={handleQuestCreated} />}

        <section id="quests" className="quests-section">
          <div className="section-header">
            <h2>Quest Board</h2>
            <p>Members can accept available quests and mark them complete.</p>
          </div>
          
          {loading ? (
            <p>Loading quests...</p>
          ) : quests.length === 0 ? (
            <p>No quests yet. Be the first to post one.</p>
          ) : (
            <div id="questList" className="quest-list">
              {quests.map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  user={user}
                  onAccept={handleAcceptQuest}
                  onComplete={handleCompleteQuest}
                  onPayment={handlePayment}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer style={{ textAlign: 'center', padding: '2rem', color: '#c3bdd4', marginTop: '2rem' }}>
        <p>&copy; {new Date().getFullYear()} Kindred Guild. All rights reserved.</p>
        <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
          <a href="#terms" style={{ color: '#c3bdd4' }}>Terms of Service</a> |{' '}
          <a href="#privacy" style={{ color: '#c3bdd4' }}>Privacy Policy</a>
        </p>
      </footer>
    </>
  );
}

export default App;
