import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SubStatus = "trial" | "active" | "past_due" | "expired" | "inactive";

interface SubscriptionRow {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  price_id: string | null;
}

interface SubInfo {
  status: SubStatus;
  trialEndDate: Date | null;
  daysLeft: number;
  loading: boolean;
  isBlocked: boolean;
  // Subscription details (when paid)
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  hasSubscription: boolean;
  refresh: () => Promise<void>;
}

export const useSubscription = (): SubInfo => {
  const { user, isAdmin } = useAuth();
  const [status, setStatus] = useState<SubStatus>("trial");
  const [trialEndDate, setTrialEndDate] = useState<Date | null>(null);
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    await supabase.rpc("expire_trial_if_needed", { _user_id: user.id });

    const [{ data: profile }, { data: subRow }] = await Promise.all([
      supabase
        .from("profiles")
        .select("status, trial_end_date")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("status, current_period_end, cancel_at_period_end, price_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profile) {
      setStatus((profile.status as SubStatus) || "trial");
      setTrialEndDate(profile.trial_end_date ? new Date(profile.trial_end_date) : null);
    }
    setSub(subRow as SubscriptionRow | null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const daysLeft = trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Only "expired" blocks; past_due keeps access (grace period).
  const isBlocked = !isAdmin && status === "expired";

  return {
    status,
    trialEndDate,
    daysLeft,
    loading,
    isBlocked,
    currentPeriodEnd: sub?.current_period_end ? new Date(sub.current_period_end) : null,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
    hasSubscription: !!sub,
    refresh: load,
  };
};
