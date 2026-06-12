import React from 'react';

const statusBadge = (status) => {
  return <span className={`badge ${status}`}>{status}</span>;
};

const formatMoney = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const QuestCard = ({ quest, user, onAccept, onComplete, onPayment }) => {
  const canAccept = quest.status === 'pending' && user;
  const canComplete = quest.status === 'accepted' && user?.id === quest.accepted_by;
  const needsPayment = quest.status === 'completed' && quest.reward > 0 && !quest.payment_status;

  const feeLabel = quest.reward > 0 ? ` • Guild fee ${quest.fee}%` : ' • Free mission';

  return (
    <article className="card quest">
      <div>
        <p className="quest-meta">
          Status: {statusBadge(quest.status)}
          {quest.payment_status && quest.reward > 0 && (
            <span className="badge paid" style={{ marginLeft: '8px', background: '#27c26f', color: '#fff' }}>
              Paid
            </span>
          )}
        </p>
        <h3 className="quest-title">{quest.title}</h3>
        <p className="quest-description">{quest.description}</p>
      </div>
      <div className="quest-footer">
        <p className="reward">
          {formatMoney(quest.reward)}
          {feeLabel}
        </p>
        <div className="actions">
          {canAccept && (
            <button className="btn accept" onClick={() => onAccept(quest.id)}>
              Accept
            </button>
          )}
          {canComplete && (
            <button className="btn complete" onClick={() => onComplete(quest.id)}>
              Complete
            </button>
          )}
          {needsPayment && (
            <button className="btn primary" onClick={() => onPayment(quest)}>
              Pay & Complete
            </button>
          )}
          {!user && quest.status === 'pending' && (
            <span className="login-prompt">Sign in to accept quests</span>
          )}
        </div>
      </div>
    </article>
  );
};

export default QuestCard;
