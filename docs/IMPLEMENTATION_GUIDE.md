# Kindred Guild Improvements — Implementation Guide

## Overview

This document outlines all improvements made to address trust concerns, improve UX, add reversible actions, and implement new features.

## Phase 1: Database Migrations ✅

### Applied Migrations

1. **Reversibility Fields** (`quests` table)
   - `is_deleted` (BOOLEAN): Soft delete flag
   - `deleted_at` (TIMESTAMP): When quest was deleted
   - `edited_at` (TIMESTAMP): When quest was last edited
   - `edit_history` (JSONB): Array of edit records

2. **Onboarding Tracking** (`user_profiles` table)
   - `onboarding_completed` (BOOLEAN): Whether user completed onboarding
   - `onboarding_completed_at` (TIMESTAMP): When onboarding was completed

3. **Worker Posts Table** (`worker_posts`)
   - `id` (UUID): Primary key
   - `user_id` (UUID): Foreign key to user_profiles
   - `title` (TEXT): Post title
   - `description` (TEXT): Post description
   - `tags` (TEXT[]): Array of tags
   - `preferred_payment` (TEXT): 'free', 'coins', 'upi', or 'any'
   - `min_reward` (INTEGER): Minimum reward expected
   - `is_deleted` (BOOLEAN): Soft delete flag
   - `deleted_at` (TIMESTAMP): When deleted
   - `created_at` (TIMESTAMP): Creation timestamp
   - `updated_at` (TIMESTAMP): Last update timestamp

4. **Action Log Table** (`action_log`)
   - `id` (UUID): Primary key
   - `user_id` (UUID): Who performed the action
   - `action_type` (TEXT): Type of action (quest_created, quest_edited, etc.)
   - `quest_id` (UUID): Related quest (if applicable)
   - `worker_post_id` (UUID): Related worker post (if applicable)
   - `old_data` (JSONB): Previous state
   - `new_data` (JSONB): New state
   - `can_undo` (BOOLEAN): Whether action can be undone
   - `undo_until` (TIMESTAMP): When undo window closes (24 hours)
   - `created_at` (TIMESTAMP): When action was logged

### New RPC Functions

1. **`soft_delete_quest(p_quest_id UUID)`**
   - Soft deletes a quest (only if status is 'open')
   - Logs action for undo capability
   - Returns BOOLEAN

2. **`restore_quest(p_quest_id UUID)`**
   - Restores a soft-deleted quest
   - Only poster can restore
   - Returns BOOLEAN

3. **`edit_quest(p_quest_id, p_title, p_description, p_tags, p_coin_amount, p_upi_amount)`**
   - Edits quest fields
   - Handles coin balance changes (increase/decrease)
   - Tracks edit history
   - Logs action for undo
   - Returns BOOLEAN

4. **`post_worker_availability(p_title, p_description, p_tags, p_preferred_payment, p_min_reward)`**
   - Creates a new worker availability post
   - Logs action
   - Returns UUID (post ID)

5. **`soft_delete_worker_post(p_post_id UUID)`**
   - Soft deletes a worker post
   - Logs action for undo
   - Returns BOOLEAN

## Phase 2: Frontend Implementation

### New Files Created

#### 1. **onboarding.js**
- **Purpose**: In-game walkthrough and emotional onboarding
- **Features**:
  - 6-step guided experience
  - Emotional messaging alongside logical explanations
  - Checks `onboarding_completed` flag before showing
  - Allows skip or complete
  - Marks completion in database
- **Integration**: Add to quest-board.html and other main pages
  ```html
  <script src="onboarding.js"></script>
  ```

#### 2. **quest-edit.js**
- **Purpose**: Edit quest details and cancel quests
- **Features**:
  - Toggle edit mode
  - Update title, description, tags
  - Adjust coin/UPI amounts
  - Cancel quest (soft delete with refund)
  - Calls `edit_quest` and `soft_delete_quest` RPCs
- **Integration**: Create quest-edit.html page with this script
  ```html
  <script src="quest-edit.js"></script>
  ```

#### 3. **worker-post.js**
- **Purpose**: Manage worker availability posts
- **Features**:
  - Post availability ("Adventurers for Hire")
  - View all active worker posts
  - Delete own posts
  - Contact workers (placeholder for messaging)
  - Calls `post_worker_availability` and `soft_delete_worker_post` RPCs
- **Integration**: Create worker-post.html page with this script
  ```html
  <script src="worker-post.js"></script>
  ```

#### 4. **undo-actions.js**
- **Purpose**: Reversible actions and undo functionality
- **Features**:
  - Load recent actions (24-hour undo window)
  - Display action history
  - Undo deleted quests/posts
  - Revert edited quests
  - Shows time remaining for undo
- **Integration**: Create undo-history.html page or add to profile
  ```html
  <script src="undo-actions.js"></script>
  ```

#### 5. **trust-and-safety.html**
- **Purpose**: Dedicated page addressing legitimacy concerns
- **Content**:
  - "We're Not a Scam" section
  - How money is protected (escrow, fees)
  - Who we are (independent, no VC)
  - What makes us different
  - Safety commitments
- **Integration**: Link from navbar and footer
  ```html
  <a href="trust-and-safety.html">Trust & Safety</a>
  ```

### Updated Files

#### 1. **index.html**
- Added "Trust & Safety" link to navbar
- Updated support section messaging
- Changed focus to transparency and protection
- Added "How We Protect You" CTA button

#### 2. **quest-board.js**
- Update to filter out deleted quests:
  ```javascript
  query = query.eq('is_deleted', false);
  ```

#### 3. **quest-detail.html & quest_detail_controller.js**
- Add edit button for quest posters
- Add cancel quest button
- Link to quest-edit.html
- Show edit history if available

## Phase 3: UX Improvements

### Trust & Legitimacy Fixes

1. **Transparency Page**: New trust-and-safety.html addresses scam concerns
2. **Clear Messaging**: Landing page emphasizes escrow, transparency, independence
3. **Fee Disclosure**: 10% commission clearly stated everywhere
4. **Data Privacy**: Explicit commitment to not selling data
5. **Reversibility**: Users can undo actions within 24 hours

### Onboarding Experience

The 6-step walkthrough covers:
1. **Welcome**: Emotional hook about community
2. **Quest Board**: How to find work
3. **Fairy Coins**: Currency explained (trust-based, not crypto)
4. **How It Works**: Process overview
5. **Safety & Trust**: Escrow and dispute resolution
6. **Ready to Begin**: Call to action

Each step includes:
- Clear title
- Logical explanation
- Emotional message
- Skip or continue options

### Reversible Actions

Users can now:
- **Edit quests**: Change title, description, tags, rewards (while open/accepted)
- **Cancel quests**: Delete open quests and get full refund
- **Delete worker posts**: Remove availability posts
- **Undo actions**: Restore deleted items within 24 hours

## Phase 4: New Features

### 1. Editable Quests

**What Changed**: Quests are no longer immutable after posting

**How It Works**:
- Posters can edit while quest is 'open' or 'accepted'
- Can change: title, description, tags, reward amount
- Increasing reward: additional coins deducted from balance
- Decreasing reward: difference refunded
- All changes tracked in edit_history

**UI**: "Edit Quest" button on quest-detail.html (for poster only)

### 2. Worker Availability Posts

**What Changed**: New "Adventurers for Hire" section

**How It Works**:
- Workers post their availability and skills
- Specify preferred payment type (free, coins, UPI, any)
- Set minimum reward expectations
- Posters can browse and contact workers
- Workers can delete their posts anytime

**UI**: New worker-post.html page with form and listing

### 3. Reversible Actions

**What Changed**: Users can undo mistakes within 24 hours

**How It Works**:
- Every action logged in action_log table
- Actions marked as undoable for 24 hours
- After 24 hours, undo window closes
- Undo restores previous state

**Undoable Actions**:
- Quest deletion
- Worker post deletion
- Quest edits (revert to previous version)

**UI**: Undo history page showing recent actions with undo buttons

### 4. Appraisal & Value Adjustment

**Future Enhancement** (Foundation laid):
- Posters can "appraise" (increase reward) to attract better workers
- Workers can propose value changes during negotiation
- All changes tracked and logged

## Integration Checklist

### Database
- [x] Apply migrations for new columns and tables
- [x] Create new RPC functions
- [x] Set up RLS policies

### Frontend - New Pages
- [ ] Create quest-edit.html with quest-edit.js
- [ ] Create worker-post.html with worker-post.js
- [ ] Create undo-history.html with undo-actions.js
- [ ] Create trust-and-safety.html (already done)

### Frontend - Updates
- [ ] Add onboarding.js to quest-board.html
- [ ] Update quest-board.js to filter deleted quests
- [ ] Update quest-detail.html with edit/cancel buttons
- [ ] Update quest_detail_controller.js to support editing
- [ ] Update index.html (already done)
- [ ] Add links to new pages in navbar/footer

### Testing
- [ ] Test quest editing (increase/decrease rewards)
- [ ] Test quest cancellation and refunds
- [ ] Test worker post creation and deletion
- [ ] Test undo functionality (24-hour window)
- [ ] Test onboarding flow
- [ ] Test soft delete filtering

## Deployment Steps

1. **Database**: Apply all migrations via Supabase console
2. **Files**: Upload all new .js and .html files to Vercel
3. **Testing**: Test each feature in staging
4. **Go Live**: Deploy to production
5. **Monitor**: Check logs for errors

## Future Enhancements

1. **Messaging System**: Direct messaging between posters and workers
2. **Appraisal System**: Dynamic reward adjustments
3. **Reputation Badges**: Earned through consistent work
4. **Skill Verification**: Optional skill badges
5. **Community Guidelines**: Detailed code of conduct
6. **Moderation Tools**: Admin dashboard for handling disputes

## Support & Questions

If users have questions about:
- **Trust**: Point to trust-and-safety.html
- **Reversibility**: Show undo-history.html
- **Features**: Explain in onboarding or help docs
- **Safety**: Reference action_log and escrow system

---

**Last Updated**: 2026-07-05
**Status**: Ready for Integration
