import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

// Map period (months) -> human-readable price lookup key
const PRICE_BY_MONTHS: Record<number, string> = {
  1: "controla_pro_1m_price",
  3: "controla_pro_3m_price",
  6: "controla_pro_6m_price",
  12: "controla_pro_12m_price",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { months, customerEmail, userId, returnUrl, environment, paymentMethod } = body ?? {};

    const monthsNum = Number(months);
    if (!PRICE_BY_MONTHS[monthsNum]) {
      throw new Error("Invalid months. Must be 1, 3, 6 or 12.");
    }
    const priceId = PRICE_BY_MONTHS[monthsNum];

    if (!returnUrl || typeof returnUrl !== "string") throw new Error("Invalid returnUrl");
    if (environment !== "sandbox" && environment !== "live") {
      throw new Error("Invalid environment");
    }
    const env: StripeEnv = environment;

    const stripe = createStripeClient(env);

    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    if (!prices.data.length) throw new Error("Price not found");
    const stripePrice = prices.data[0];

    // Allow restricting to a single payment method (e.g. only "pix" or only "card"),
    // or default to both.
    const allowedMethods: ("card" | "pix")[] =
      paymentMethod === "pix" ? ["pix"]
      : paymentMethod === "card" ? ["card"]
      : ["card", "pix"];

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded",
      return_url: returnUrl,
      payment_method_types: allowedMethods,
      // Pix expires in 24h by default; keep explicit for clarity
      payment_method_options: {
        pix: { expires_after_seconds: 86400 },
      },
      ...(customerEmail && { customer_email: customerEmail }),
      metadata: {
        ...(userId ? { userId } : {}),
        months: String(monthsNum),
        product_kind: "controla_pro_period",
      },
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
