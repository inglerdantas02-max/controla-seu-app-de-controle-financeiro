import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
  }
  return _supabase;
}

// Extend the profile's access by N months from the later of (now, current expires_at).
async function extendProfileAccess(userId: string, months: number) {
  const supabase = getSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("expires_at")
    .eq("id", userId)
    .maybeSingle();

  const now = new Date();
  const baseDate =
    profile?.expires_at && new Date(profile.expires_at) > now
      ? new Date(profile.expires_at)
      : now;

  const newExpires = new Date(baseDate);
  newExpires.setMonth(newExpires.getMonth() + months);

  await supabase
    .from("profiles")
    .update({
      status: "active",
      expires_at: newExpires.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", userId);

  return newExpires;
}

async function handleCheckoutSessionCompleted(session: any, env: StripeEnv) {
  // Only handle our period-based one-time purchases here
  const kind = session.metadata?.product_kind;
  if (kind !== "controla_pro_period") {
    console.log("Ignoring non-period checkout session", session.id);
    return;
  }

  const userId = session.metadata?.userId;
  const monthsRaw = session.metadata?.months;
  const months = Number(monthsRaw);
  if (!userId || !months) {
    console.error("Missing userId/months in checkout session metadata", session.id);
    return;
  }

  // For Pix and other async methods, payment_status may still be "unpaid" here.
  // Only extend access when actually paid.
  if (session.payment_status !== "paid") {
    console.log("Checkout session not yet paid", session.id, session.payment_status);
    return;
  }

  const newExpires = await extendProfileAccess(userId, months);
  console.log(`Extended access for ${userId} by ${months} months -> ${newExpires.toISOString()}`);

  // Record purchase for history (use session.id as the synthetic subscription id)
  const supabase = getSupabase();
  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: session.id,
      stripe_customer_id: session.customer || session.customer_details?.email || "guest",
      product_id: `controla_pro_${months}m`,
      price_id: `controla_pro_${months}m_price`,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: newExpires.toISOString(),
      cancel_at_period_end: true, // one-time purchase, doesn't renew
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );
}

// Pix payments are async — Stripe sends checkout.session.async_payment_succeeded
// when the customer completes the Pix payment after closing the form.
async function handleAsyncPaymentSucceeded(session: any, env: StripeEnv) {
  // Same logic as completed-with-paid
  await handleCheckoutSessionCompleted({ ...session, payment_status: "paid" }, env);
}

async function handleAsyncPaymentFailed(session: any) {
  console.log("Async payment failed for session", session.id);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;

  try {
    const event = await verifyWebhook(req, env);
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object, env);
        break;
      case "checkout.session.async_payment_succeeded":
        await handleAsyncPaymentSucceeded(event.data.object, env);
        break;
      case "checkout.session.async_payment_failed":
        await handleAsyncPaymentFailed(event.data.object);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
