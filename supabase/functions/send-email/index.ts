// =========================================================================
// KINDRED GUILD — EMAIL NOTIFICATIONS (Supabase Edge Function)
// Uses Resend API for transactional emails
// Deploy: supabase functions deploy send-email
// Set secret: supabase secrets set RESEND_API_KEY=re_xxxxx
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FROM_EMAIL = "Kindred Guild <notifications@kindredguild.org>";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  type: "quest_accepted" | "proof_submitted" | "quest_approved" | "quest_completed" | "wish_created" | "coin_credited" | "dispute_filed";
  quest_id?: string;
  wish_id?: string;
  recipient_id: string;
  extra?: Record<string, string>;
}

const templates: Record<string, (data: any) => { subject: string; html: string }> = {
  quest_accepted: (data) => ({
    subject: `⚔️ Your quest "${data.title}" was accepted!`,
    html: `
      <div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px;background:#0f0f0f;color:#e0e0e0;border-radius:12px">
        <h2 style="color:#d4af37;margin-bottom:16px">⚔️ Quest Accepted</h2>
        <p>Hey <strong>${data.poster_name}</strong>,</p>
        <p><strong>${data.worker_name}</strong> has accepted your quest:</p>
        <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;margin:16px 0">
          <h3 style="color:#d4af37;margin:0 0 8px">${data.title}</h3>
          <p style="color:#888;margin:0">${data.description?.substring(0, 150)}...</p>
        </div>
        <p>They'll work on it and submit proof when done. You'll get notified when they do.</p>
        <a href="https://kindredguild.org/quest-detail.html?id=${data.quest_id}" style="display:inline-block;background:#d4af37;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px">View Quest →</a>
        <hr style="border:none;border-top:1px solid #333;margin:24px 0">
        <p style="color:#666;font-size:0.8rem">Kindred Guild — Help your community, earn trust.</p>
      </div>
    `,
  }),

  proof_submitted: (data) => ({
    subject: `📋 Proof submitted for "${data.title}"`,
    html: `
      <div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px;background:#0f0f0f;color:#e0e0e0;border-radius:12px">
        <h2 style="color:#d4af37;margin-bottom:16px">📋 Proof Submitted</h2>
        <p>Hey <strong>${data.poster_name}</strong>,</p>
        <p><strong>${data.worker_name}</strong> has submitted proof for your quest:</p>
        <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;margin:16px 0">
          <h3 style="color:#d4af37;margin:0 0 8px">${data.title}</h3>
        </div>
        <p><strong>You have 48 hours</strong> to review and approve. If you don't respond, it auto-approves.</p>
        <a href="https://kindredguild.org/quest-detail.html?id=${data.quest_id}" style="display:inline-block;background:#d4af37;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px">Review Proof →</a>
        <hr style="border:none;border-top:1px solid #333;margin:24px 0">
        <p style="color:#666;font-size:0.8rem">Kindred Guild — Help your community, earn trust.</p>
      </div>
    `,
  }),

  quest_approved: (data) => ({
    subject: `✅ Quest "${data.title}" approved! Payment released.`,
    html: `
      <div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px;background:#0f0f0f;color:#e0e0e0;border-radius:12px">
        <h2 style="color:#10b981;margin-bottom:16px">✅ Quest Approved</h2>
        <p>Hey <strong>${data.worker_name}</strong>,</p>
        <p>Your work on "<strong>${data.title}</strong>" has been approved!</p>
        ${data.payment_type === 'coins' ? `<p style="font-size:1.2rem;color:#d4af37;font-weight:bold">+${data.coin_amount} FC credited to your wallet.</p>` : ''}
        ${data.payment_type === 'upi' ? `<p>The poster will send your UPI payment shortly.</p>` : ''}
        <p>Both of you can now rate each other.</p>
        <a href="https://kindredguild.org/quest-detail.html?id=${data.quest_id}" style="display:inline-block;background:#d4af37;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px">View Quest →</a>
        <hr style="border:none;border-top:1px solid #333;margin:24px 0">
        <p style="color:#666;font-size:0.8rem">Kindred Guild — Help your community, earn trust.</p>
      </div>
    `,
  }),

  coin_credited: (data) => ({
    subject: `🪙 ${data.amount} Fairy Coins credited!`,
    html: `
      <div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px;background:#0f0f0f;color:#e0e0e0;border-radius:12px">
        <h2 style="color:#d4af37;margin-bottom:16px">🪙 Coins Credited</h2>
        <p>Hey <strong>${data.username}</strong>,</p>
        <p>Your purchase has been verified! <strong style="color:#d4af37;font-size:1.2rem">+${data.amount} FC</strong> has been added to your wallet.</p>
        <p>Use them to post paid quests or back community wishes.</p>
        <a href="https://kindredguild.org/quest-board.html" style="display:inline-block;background:#d4af37;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px">Browse Tasks →</a>
        <hr style="border:none;border-top:1px solid #333;margin:24px 0">
        <p style="color:#666;font-size:0.8rem">Kindred Guild — Help your community, earn trust.</p>
      </div>
    `,
  }),

  dispute_filed: (data) => ({
    subject: `⚠️ Dispute filed on "${data.title}"`,
    html: `
      <div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:20px;background:#0f0f0f;color:#e0e0e0;border-radius:12px">
        <h2 style="color:#ef4444;margin-bottom:16px">⚠️ Dispute Filed</h2>
        <p>Hey,</p>
        <p>A dispute has been filed on quest "<strong>${data.title}</strong>".</p>
        <p>Funds are locked until both sides resolve this. Please check the quest workspace and communicate.</p>
        <a href="https://kindredguild.org/quest-detail.html?id=${data.quest_id}" style="display:inline-block;background:#d4af37;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px">View Dispute →</a>
        <hr style="border:none;border-top:1px solid #333;margin:24px 0">
        <p style="color:#666;font-size:0.8rem">Kindred Guild — Help your community, earn trust.</p>
      </div>
    `,
  }),
};

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error: ${res.status} ${err}`);
  }

  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: EmailPayload = await req.json();
    const template = templates[payload.type];
    if (!template) {
      return new Response(JSON.stringify({ error: "Unknown email type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recipient profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("username, display_name, user_id")
      .eq("user_id", payload.recipient_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Recipient not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch quest/wish details if needed
    let questData: any = {};
    if (payload.quest_id) {
      const { data: quest } = await supabase
        .from("quests")
        .select("title, description, payment_type, coin_amount, poster_id, worker_id")
        .eq("id", payload.quest_id)
        .single();
      questData = quest || {};

      // Fetch poster/worker names
      if (questData.poster_id) {
        const { data: p } = await supabase.from("user_profiles").select("display_name, username").eq("user_id", questData.poster_id).single();
        questData.poster_name = p?.display_name || p?.username || "Someone";
      }
      if (questData.worker_id) {
        const { data: w } = await supabase.from("user_profiles").select("display_name, username").eq("user_id", questData.worker_id).single();
        questData.worker_name = w?.display_name || w?.username || "Someone";
      }
    }

    const templateData = {
      ...questData,
      ...payload.extra,
      quest_id: payload.quest_id,
      username: profile.display_name || profile.username,
    };

    // Fetch recipient email from auth.users
    const { data: authUser } = await supabase.auth.admin.getUserById(payload.recipient_id);
    const email = authUser?.user?.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "Recipient email not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = template(templateData);
    const result = await sendEmail(email, subject, html);

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Email function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
