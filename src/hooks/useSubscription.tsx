import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SubStatus = "trial" | "active" | "expired" | "inactive";

interface SubInfo {
  status: SubStatus;
  trialEndDate: Date | null;
  daysLeft: number;
  loading: boolean;
  isBlocked: boolean;
  refresh: () => Promise<void>;
}

export const useSubscription = (): SubInfo => {
  const { user, isAdmin } = useAuth();
  const [status, setStatus] = useState<SubStatus>("trial");
  const [trialEndDate, setTrialEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("status, trial_end_date")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      const end = data.trial_end_date ? new Date(data.trial_end_date) : null;
      let st = (data.status as SubStatus) || "trial";
      // Auto-expire on client side if trial passed and still marked as trial
      if (st === "trial" && end && end.getTime() < Date.now()) {
        st = "expired";
        await supabase.from("profiles").update({ status: "expired" }).eq("id", user.id);
      }
      setStatus(st);
      setTrialEndDate(end);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const daysLeft = trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isBlocked = !isAdmin && status === "expired";

  return { status, trialEndDate, daysLeft, loading, isBlocked, refresh: load };
};
