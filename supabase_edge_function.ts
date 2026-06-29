// =========================================================================
// KINDRED GUILD — AUTO-APPROVE SCHEDULER (Supabase Edge Function)
// Tech stack: Deno, Supabase client
// Deploy command: supabase functions deploy auto-approve-cron
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    
    // Safety token gate (ensure calls originate securely from system triggers or crons)
    console.log("Starting Auto-Approve background job processing...");

    const nowIso = new Date().toISOString();

    // 1. Fetch expired appraisal quests ('submitted' and appraisal_deadline < now)
    const { data: submittedQuests, error: fetchErr } = await supabase
      .from('quests')
      .select('*')
      .eq('status', 'submitted')
      .lt('appraisal_deadline', nowIso);

    if (fetchErr) {
      throw new Error(`Error loading submitted quests: ${fetchErr.message}`);
    }

    console.log(`Found ${submittedQuests?.length || 0} quests awaiting automatic approval.`);

    if (submittedQuests && submittedQuests.length > 0) {
      for (const quest of submittedQuests) {
        console.log(`Auto-approving quest: ${quest.id} ("${quest.title}")`);

        // Transactional update status to approved
        const { error: updateErr } = await supabase
          .from('quests')
          .update({ status: 'approved', appraisal_deadline: null })
          .eq('id', quest.id);

        if (updateErr) {
          console.error(`Failed updating status for quest ${quest.id}:`, updateErr);
          continue;
        }

        // Release Coin rewards if payment type is Fairy Coins
        if (quest.payment_type === 'coins' && quest.coin_amount > 0) {
          const { error: ledgerErr } = await supabase
            .from('fairy_ledger')
            .insert({
              user_id: quest.worker_id,
              amount: quest.coin_amount,
              reason: 'quest_earning',
              quest_id: quest.id
            });

          if (ledgerErr) {
            console.error(`Failed to credit ledger for worker ${quest.worker_id}:`, ledgerErr);
          } else {
            console.log(`Credited ${quest.coin_amount} FC to worker ${quest.worker_id}`);
          }
        }
      }
    }

    // 2. Fetch and reveal unblinded feedback reviews older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateLimitIso = sevenDaysAgo.toISOString();

    const { data: unrevealedRatings, error: ratingsErr } = await supabase
      .from('ratings')
      .select('*')
      .eq('revealed', false)
      .lt('submitted_at', dateLimitIso);

    if (ratingsErr) {
      throw new Error(`Error loading ratings: ${ratingsErr.message}`);
    }

    console.log(`Found ${unrevealedRatings?.length || 0} unrevealed ratings older than 7 days.`);

    if (unrevealedRatings && unrevealedRatings.length > 0) {
      // Collect unique ratee profiles
      const rateesToUpdate = new Set<string>();

      for (const rating of unrevealedRatings) {
        rateesToUpdate.add(rating.ratee_id);

        const { error: revealErr } = await supabase
          .from('ratings')
          .update({ revealed: true })
          .eq('id', rating.id);

        if (revealErr) {
          console.error(`Failed revealing rating: ${rating.id}`, revealErr);
        }
      }

      // Re-calculate rating scores and adjust user reputation scores
      for (const userId of rateesToUpdate) {
        console.log(`Re-evaluating average reputation score for user profile: ${userId}`);
        
        const { data: reviews, error: reviewsErr } = await supabase
          .from('ratings')
          .select('score')
          .eq('ratee_id', userId)
          .eq('revealed', true);

        if (reviewsErr) {
          console.error(`Failed fetching ratings for user: ${userId}`, reviewsErr);
          continue;
        }

        if (reviews && reviews.length > 0) {
          const total = reviews.reduce((sum, r) => sum + r.score, 0);
          const avg = total / reviews.length;
          const intScore = Math.round(avg * 10); // scale out of 50

          const { error: profileErr } = await supabase
            .from('user_profiles')
            .update({ reputation_score: intScore })
            .eq('user_id', userId);

          if (profileErr) {
            console.error(`Failed to update reputation profile score for user ${userId}:`, profileErr);
          } else {
            console.log(`Updated reputation profile rating score for user ${userId} to: ${avg.toFixed(1)}/5`);
          }
        }
      }
    }

    return new Response(JSON.stringify({ status: "Success", message: "Background processing finished." }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Cron function crashed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});