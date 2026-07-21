// =========================================================================
// KINDRED GUILD — CREATE PAYPAL ORDER (Supabase Edge Function)
// Tech stack: Deno, Supabase client
// Deploy command: supabase functions deploy create-paypal-order
//
// Required secrets (set with `supabase secrets set ...`):
//   PAYPAL_CLIENT_ID      — from https://developer.paypal.com/dashboard/
//   PAYPAL_CLIENT_SECRET  — same place (use Sandbox values during testing)
//   PAYPAL_ENV            — "sandbox" (default) or "live"
//   SUPABASE_URL          — auto-set by Supabase
//   SUPABASE_ANON_KEY     — auto-set by Supabase
//
// Flow:
//   client -> { coins, amount_usd, payment_note }
//   server -> verify JWT, recompute amount_usd server-side (DO NOT trust client)
//   server -> PayPal Orders API (POST /v2/checkout/orders)
//   server -> { orderId }
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") || "";
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
const PAYPAL_ENV = (Deno.env.get("PAYPAL_ENV") || "sandbox").toLowerCase();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const PAYPAL_API_BASE =
  PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const SITE_ORIGIN = Deno.env.get("SITE_ORIGIN") || "https://kindredguild.org";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Canonical price table. MUST match coin_purchase_js_logic.js BASE_USD_PRICES.
// The client sends us amount_usd for display convenience only — we ALWAYS
// recompute the real charge from this server-side table so a malicious client
// can't request 1000 FC for $0.50.
// ---------------------------------------------------------------------------
const BASE_USD_PRICES: Record<number, number> = {
  100: 1.20,
  200: 2.40,
  500: 6.00,
  1000: 12.00,
};

const PAYPAL_FEE_PERCENT = 0.044;
const PAYPAL_FIXED_FEE_USD = 0.30;
const PLATFORM_PROFIT_MARGIN = 0.10;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeChargeUsd(baseUsd: number): number {
  const target = baseUsd * (1 + PLATFORM_PROFIT_MARGIN);
  const charged = (target + PAYPAL_FIXED_FEE_USD) / (1 - PAYPAL_FEE_PERCENT);
  return round2(charged);
}

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
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    return jsonResponse(
      { error: "PayPal is not configured on the server. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET." },
      500,
    );
  }

  // ---------------------------------------------------------------------------
  // Authenticate the caller against Supabase using their JWT.
  // Previously we only checked the Authorization header started with "bearer ",
  // which means anyone with any string could create orders. Now we verify the
  // JWT resolves to a real Supabase user before doing anything else.
  // ---------------------------------------------------------------------------
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Invalid user session" }, 401);
  }

  let payload: { coins?: number; amount_usd?: number; payment_note?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const coins = Number(payload.coins);
  const paymentNote = String(payload.payment_note || "").slice(0, 120);

  if (!Number.isInteger(coins) || coins <= 0) {
    return jsonResponse({ error: "coins must be a positive integer" }, 400);
  }

  // ---------------------------------------------------------------------------
  // CRITICAL: Look up the canonical base price for `coins` server-side and
  // recompute the charge. Ignore the client-supplied amount_usd entirely —
  // a malicious user could otherwise pass coins=1000 & amount_usd=0.50 and
  // receive 1000 FC for $0.50 after admin approval.
  // ---------------------------------------------------------------------------
  const baseUsd = BASE_USD_PRICES[coins];
  if (typeof baseUsd !== "number" || !Number.isFinite(baseUsd) || baseUsd <= 0) {
    return jsonResponse(
      { error: `No price tier defined for ${coins} coins` },
      400,
    );
  }
  const amountUsd = computeChargeUsd(baseUsd);

  if (amountUsd < 0.5) {
    // PayPal minimum for USD
    return jsonResponse({ error: "amount_usd is below PayPal's minimum" }, 400);
  }

  // Round to 2 decimals, PayPal requires strings for amounts
  const amountStr = amountUsd.toFixed(2);

  try {
    const accessToken = await getPayPalAccessToken();

    // Create PayPal order
    const orderRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": paymentNote || `kg-${Date.now()}`, // idempotency
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: paymentNote || `kg-${coins}fc`,
            description: `${coins} Fairy Coins — Kindred Guild`,
            custom_id: paymentNote || "",
            amount: {
              currency_code: "USD",
              value: amountStr,
              breakdown: {
                item_total: { currency_code: "USD", value: amountStr },
              },
            },
            items: [
              {
                name: `${coins} Fairy Coins`,
                description: "In-game currency for Kindred Guild",
                unit_amount: { currency_code: "USD", value: amountStr },
                quantity: "1",
                category: "DIGITAL_GOODS",
              },
            ],
          },
        ],
        application_context: {
          brand_name: "Kindred Guild",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: `${SITE_ORIGIN}/coin_purchase_ui.html?paypal=return`,
          cancel_url: `${SITE_ORIGIN}/coin_purchase_ui.html?paypal=cancel`,
        },
      }),
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      console.error("PayPal create order failed:", errText);
      return jsonResponse(
        { error: "Failed to create PayPal order", detail: errText },
        502,
      );
    }

    const order = await orderRes.json();
    return jsonResponse({
      orderId: order.id,
      status: order.status,
      env: PAYPAL_ENV,
      charged_usd: amountUsd, // echo back so the client can sanity-check
    });
  } catch (err) {
    console.error("create-paypal-order crashed:", err);
    return jsonResponse(
      { error: (err as Error).message || "Internal error" },
      500,
    );
  }
});
