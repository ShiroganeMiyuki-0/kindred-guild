if (typeof document === 'undefined') {
  console.error('This script is for browsers. Open index.html in a browser or use a static server.');
} else {
  const questForm = document.getElementById('questForm');
  const questList = document.getElementById('questList');
  const questTemplate = document.getElementById('questTemplate');
  
  const totalQuestsEl = document.getElementById('totalQuests');
  const paidQuestsEl = document.getElementById('paidQuests');
  const guildRevenueEl = document.getElementById('guildRevenue');
  
  const seedQuests = [
    {
      id: crypto.randomUUID(),
      title: 'Escort celestial key merchant',
      description: 'Protect a traveling merchant from Clover to Magnolia.',
      reward: 250,
      fee: 10,
      status: 'pending'
    },
    {
      id: crypto.randomUUID(),
      title: 'Guild hall cleanup raid',
      description: 'Volunteer mission after festival night. Snacks included.',
      reward: 0,
      fee: 0,
      status: 'pending'
    }
  ];
  
  let quests = [...seedQuests];
  
  function statusBadge(status) {
    return `<span class="badge ${status}">${status}</span>`;
  }
  
  function formatMoney(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }
  
  function computeStats() {
    const total = quests.length;
    const paid = quests.filter((q) => q.reward > 0).length;
    const revenue = quests
      .filter((q) => q.status === 'completed' && q.reward > 0)
      .reduce((sum, q) => sum + q.reward * (q.fee / 100), 0);
  
    totalQuestsEl.textContent = total;
    paidQuestsEl.textContent = paid;
    guildRevenueEl.textContent = formatMoney(revenue);
  }
  
  function renderQuests() {
    questList.innerHTML = '';
  
    if (quests.length === 0) {
      questList.innerHTML = '<p>No quests yet. Be the first to post one.</p>';
      computeStats();
      return;
    }
  
    quests.forEach((quest) => {
      const node = questTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector('.quest-meta').innerHTML = `Status: ${statusBadge(quest.status)}`;
      node.querySelector('.quest-title').textContent = quest.title;
      node.querySelector('.quest-description').textContent = quest.description;
  
      const feeLabel = quest.reward > 0 ? ` • Guild fee ${quest.fee}%` : ' • Free mission';
      node.querySelector('.reward').textContent = `${formatMoney(quest.reward)}${feeLabel}`;
  
      const acceptBtn = node.querySelector('.accept');
      const completeBtn = node.querySelector('.complete');
  
      acceptBtn.disabled = quest.status !== 'pending';
      completeBtn.disabled = quest.status !== 'accepted';
  
      acceptBtn.addEventListener('click', () => {
        quests = quests.map((q) => (q.id === quest.id ? { ...q, status: 'accepted' } : q));
        renderQuests();
      });
  
      completeBtn.addEventListener('click', () => {
        quests = quests.map((q) => (q.id === quest.id ? { ...q, status: 'completed' } : q));
        renderQuests();
      });
  
      questList.appendChild(node);
    });
  
    computeStats();
  }
  
  questForm.addEventListener('submit', (event) => {
    event.preventDefault();
  
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const reward = Number(document.getElementById('reward').value) || 0;
    let fee = Number(document.getElementById('fee').value) || 0;
  
    if (!title || !description || reward < 0) return;
  
    if (reward === 0) {
      fee = 0;
    }
  
    quests.unshift({
      id: crypto.randomUUID(),
      title,
      description,
      reward,
      fee,
      status: 'pending'
    });
  
    questForm.reset();
    document.getElementById('reward').value = 0;
    document.getElementById('fee').value = 10;
  
    renderQuests();
  });
  
  renderQuests();
}
