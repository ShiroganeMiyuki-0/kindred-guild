import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const Stats = ({ quests }) => {
  const [stats, setStats] = useState({ total: 0, paid: 0, revenue: 0 });

  useEffect(() => {
    const total = quests.length;
    const paid = quests.filter((q) => q.reward > 0 && q.payment_status === 'paid').length;
    const revenue = quests
      .filter((q) => q.status === 'completed' && q.reward > 0 && q.payment_status === 'paid')
      .reduce((sum, q) => sum + q.reward * (q.fee / 100), 0);

    setStats({ total, paid, revenue });
  }, [quests]);

  const formatMoney = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <section className="stats">
      <article>
        <h2 id="totalQuests">{stats.total}</h2>
        <p>Total quests</p>
      </article>
      <article>
        <h2 id="paidQuests">{stats.paid}</h2>
        <p>Paid contracts</p>
      </article>
      <article>
        <h2 id="guildRevenue">{formatMoney(stats.revenue)}</h2>
        <p>Estimated guild cut</p>
      </article>
    </section>
  );
};

export default Stats;
