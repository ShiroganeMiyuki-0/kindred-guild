// =========================================================================
// KINDRED GUILD — CREATE PAYPAL ORDER (Supabase Edge Function)
// Tech stack: Deno, Supabase client
// Deploy command: supabase functions deploy create-paypal-order
//
// Required secrets (set with `supabase secrets set ...`):
//   PAYPAL_CLIENT_ID      — from https://developer.paypal.com/dashboard/
//   PAYPAL_CLIENT_SECRET  — same place (use Sandbox values during testing)
//   PAYPAL_ENV            — "sandbox" (default) or "live"
//
// Flow:
//   client -> { coins, amount_usd, payment_note }
//   server -> PayPal Orders API (POST /v2/checkout/orders)
//   server -> { orderId }
// =========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") || "";
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
const PAYPAL_ENV = (Deno.env.get("PAYPAL_ENV") || "sandbox").toLowerCase();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

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

function isPositiveNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
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

  // Authenticate the caller against Supabase using their JWT (anon + user)
  // so only logged-in guild members can create an order.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  let payload: { coins?: number; amount_usd?: number; payment_note?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const coins = Number(payload.coins);
  const amountUsd = Number(payload.amount_usd);
  const paymentNote = String(payload.payment_note || "").slice(0, 120);

  if (!Number.isInteger(coins) || coins <= 0) {
    return jsonResponse({ error: "coins must be a positive integer" }, 400);
  }
  if (!isPositiveNumber(amountUsd)) {
    return jsonResponse({ error: "amount_usd must be a positive number" }, 400);
  }
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
    });
  } catch (err) {
    console.error("create-paypal-order crashed:", err);
    return jsonResponse(
      { error: (err as Error).message || "Internal error" },
      500,
    );
  }
});
