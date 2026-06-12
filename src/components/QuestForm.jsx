import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const QuestForm = ({ user, onQuestCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState(0);
  const [fee, setFee] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to post a quest');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const actualFee = reward > 0 ? fee : 0;
      
      const { data, error } = await supabase
        .from('quests')
        .insert([
          {
            title,
            description,
            reward: Number(reward),
            fee: actualFee,
            status: 'pending',
            creator_id: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      onQuestCreated(data);
      setTitle('');
      setDescription('');
      setReward(0);
      setFee(10);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="create" className="card form-card">
      <h2>Create a New Quest</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Quest Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength="80"
            placeholder="Ex: Deliver magical herbs"
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="4"
            required
            maxLength="300"
            placeholder="Describe the task clearly..."
          />
        </label>
        <div className="row">
          <label>
            Reward ($)
            <input
              type="number"
              value={reward}
              onChange={(e) => setReward(Number(e.target.value))}
              min="0"
              step="1"
            />
          </label>
          <label>
            Guild Fee (%)
            <input
              type="number"
              value={fee}
              onChange={(e) => setFee(Number(e.target.value))}
              min="0"
              max="50"
              step="1"
              disabled={reward === 0}
            />
          </label>
        </div>
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Posting...' : 'Add Quest'}
        </button>
      </form>
    </section>
  );
};

export default QuestForm;
