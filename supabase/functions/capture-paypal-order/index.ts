// =========================================================================
// KINDRED GUILD — CAPTURE PAYPAL ORDER (Supabase Edge Function)
// Tech stack: Deno, Supabase client
// Deploy command: supabase functions deploy capture-paypal-order
//
// Called by the client AFTER the user finishes the PayPal popup.
// Verifies the order is actually completed (status=COMPLETED) and returns
// the captureId + payer email + amount so the client can persist a row in
// coin_purchases. The existing manual admin approval flow is reused; this
// function just guarantees the money has moved before we log the purchase.
//
// Required secrets:
//   PAYPAL_CLIENT_ID
//   PAYPAL_CLIENT_SECRET
//   PAYPAL_ENV   — "sandbox" (default) or "live"
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") || "";
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
const PAYPAL_ENV = (Deno.env.get("PAYPAL_ENV") || "sandbox").toLowerCase();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const PAYPAL_API_BASE =
  PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getPayPalAccessToken(): Promise<string> {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    return jsonResponse(
      { error: "PayPal is not configured on the server." },
      500,
    );
  }

  // Verify the caller's Supabase session.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  let payload: { order_id?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const orderId = String(payload.order_id || "").trim();
  if (!orderId) {
    return jsonResponse({ error: "order_id is required" }, 400);
  }

  // Verify the JWT is a real Supabase user
  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Invalid user session" }, 401);
  }
  const userId = userData.user.id;

  try {
    const accessToken = await getPayPalAccessToken();

    // 1. Capture the order
    const captureRes = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!captureRes.ok) {
      const errText = await captureRes.text();
      console.error("PayPal capture failed:", errText);
      return jsonResponse(
        { error: "Failed to capture PayPal order", detail: errText },
        502,
      );
    }

    const capture = await captureRes.json();

    if (capture.status !== "COMPLETED") {
      return jsonResponse(
        { error: `PayPal order not completed (status=${capture.status})` },
        400,
      );
    }

    // 2. Pull out the bits the client needs to persist
    const purchaseUnit = capture.purchase_units?.[0];
    const capturePayment = purchaseUnit?.payments?.captures?.[0];
    const payer = capture.payer || {};
    const captureId = capturePayment?.id || "";
    const amount = capturePayment?.amount?.value || "";
    const currency = capturePayment?.amount?.currency_code || "USD";
    const payerEmail = payer.email_address || "";

    if (!captureId) {
      return jsonResponse(
        { error: "Capture response missing capture id" },
        502,
      );
    }

    // 3. Idempotency guard: if this capture_id was already logged, return the
    //    existing row instead of double-inserting. Belt + suspenders since
    //    PayPal can retry capture on flaky networks.
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: existing } = await supabaseAdmin
      .from("coin_purchases")
      .select("id, status, coin_amount")
      .eq("paypal_capture_id", captureId)
      .maybeSingle();

    if (existing) {
      return jsonResponse({
        already_logged: true,
        purchase_id: existing.id,
        status: existing.status,
        coin_amount: existing.coin_amount,
        capture_id: captureId,
        payer_email: payerEmail,
        amount,
        currency,
      });
    }

    return jsonResponse({
      already_logged: false,
      capture_id: captureId,
      payer_email: payerEmail,
      amount,
      currency,
      // raw response for clients that want to inspect more
      raw: {
        order_id: capture.id,
        status: capture.status,
        reference_id: purchaseUnit?.reference_id || "",
        custom_id: purchaseUnit?.custom_id || "",
      },
    });
  } catch (err) {
    console.error("capture-paypal-order crashed:", err);
    return jsonResponse(
      { error: (err as Error).message || "Internal error" },
      500,
    );
  }
});
