# Kindred Guild Improvement Plan

## 1. Trust & UX Enhancements (Addressing "Scam" perception)
- **Visuals:** Add more "human" elements. Real-world examples of quests.
- **Copywriting:** Soften technical/crypto-sounding terms. 
    - Change "Sovereign utility token" to "Guild Credits (Fairy Coins)".
    - Add a "Safety & Trust" section on the landing page.
- **Transparency:** Add a clear "How we handle your money" section explaining the 10% commission and UPI direct payments.

## 2. In-Game Walkthrough & Onboarding
- **Technology:** Custom overlay or `driver.js`.
- **Flow:**
    1. **Welcome:** Emotional hook (Community, Mutual Aid).
    2. **The Board:** Logical hook (How to find work or post needs).
    3. **Fairy Coins:** Explain the utility (Safe, community-driven).
    4. **Safety:** Explain the escrow/dispute system.
- **Trigger:** Check `onboarding_completed` in `user_profiles`.

## 3. Feature: Editable Posts & Reversibility
- **Quest Editing:** 
    - New UI in `quest-detail.html` for posters.
    - RPC `edit_quest` to update fields.
    - Handle reward increases (deduct more coins) or decreases (refund if status is 'open').
- **Soft Delete:**
    - Add `is_deleted` column.
    - Update `loadQuests` to filter out deleted ones.
- **Undo/Cancel:**
    - Allow posters to cancel 'open' quests and get a full refund (reward + commission).

## 4. Feature: Worker Availability Posts
- **New Table:** `worker_posts`
    - Fields: `id`, `user_id`, `title`, `description`, `tags`, `preferred_payment`, `min_reward`, `is_deleted`.
- **New UI:** "Adventurers for Hire" tab on the Quest Board.
- **Interaction:** Users can "Invite" workers to a private quest.

## 5. Feature: Appraisal & Value Adjustment
- **Logic:** 
    - Posters can "Appraise" (increase value) to attract better workers.
    - Workers can "Propose" a value change during the 'accepted' phase (negotiation).

## Technical Roadmap
1. **Database:** Migrations for `user_profiles`, `quests`, and new `worker_posts` table.
2. **Backend (RPCs):** `edit_quest`, `cancel_quest`, `post_worker_availability`.
3. **Frontend:** 
    - Update `quest-post.js` and `quest-board.js`.
    - Create `worker-post.js` and `onboarding.js`.
    - Modify `quest-detail.html` for editing.
