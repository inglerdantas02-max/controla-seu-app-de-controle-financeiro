import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Bill, BillOccurrence, monthRange, todayBR } from "@/lib/bills";

/**
 * Carrega as contas fixas e as ocorrências (contas do mês) do usuário logado.
 * A geração das ocorrências é feita no banco de forma idempotente.
 */
export const useBills = (referenceMonth: Date) => {
  const { user } = useAuth();
  const db = supabase as any;
  const [bills, setBills] = useState<Bill[]>([]);
  const [occurrences, setOccurrences] = useState<BillOccurrence[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBills = useCallback(async () => {
    if (!user) return;
    const { data } = await db
      .from("bills")
      .select("*")
      .eq("user_id", user.id)
      .order("due_day", { ascending: true });
    setBills((data as unknown as Bill[]) ?? []);
  }, [user]);

  const loadOccurrences = useCallback(async () => {
    if (!user) return;
    const { start, end } = monthRange(referenceMonth);
    const { data } = await db
      .from("bill_occurrences")
      .select("*")
      .eq("user_id", user.id)
      .gte("due_date", start)
      .lte("due_date", end)
      .order("due_date", { ascending: true });
    setOccurrences((data as unknown as BillOccurrence[]) ?? []);
    setLoading(false);
  }, [user, referenceMonth]);

  const refresh = useCallback(async () => {
    if (!user) return;
    await db.rpc("generate_bill_occurrences", { _months_ahead: 3 });
    await Promise.all([loadBills(), loadOccurrences()]);
  }, [user, loadBills, loadOccurrences]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = db
      .channel(`bills-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bill_occurrences", filter: `user_id=eq.${user.id}` },
        () => loadOccurrences(),
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [user, loadOccurrences]);

  /** Marca como paga. Opcionalmente cria um gasto vinculado (sem duplicar). */
  const markPaid = useCallback(
    async (occ: BillOccurrence, createExpense: boolean) => {
      if (!user) return;
      let transactionId: string | null = occ.transaction_id;

      if (createExpense && !transactionId) {
        const { data, error } = await db
          .from("transactions")
          .insert({
            user_id: user.id,
            type: "expense",
            amount: Number(occ.amount),
            category: occ.category || "Contas",
            description: occ.name,
            occurred_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) {
          toast({ title: "Erro ao registrar o gasto", description: error.message, variant: "destructive" });
          return;
        }
        transactionId = data.id;
      }

      const { error } = await db
        .from("bill_occurrences")
        .update({ status: "paid", paid_at: new Date().toISOString(), transaction_id: transactionId })
        .eq("id", occ.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Conta paga ✅", description: occ.name });
      loadOccurrences();
    },
    [user, loadOccurrences],
  );

  /** Desfaz o pagamento. Remove o gasto vinculado, se existir. */
  const markPending = useCallback(
    async (occ: BillOccurrence) => {
      if (occ.transaction_id) {
        await db.from("transactions").delete().eq("id", occ.transaction_id);
      }
      const { error } = await db
        .from("bill_occurrences")
        .update({ status: "pending", paid_at: null, transaction_id: null })
        .eq("id", occ.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Conta marcada como pendente" });
      loadOccurrences();
    },
    [loadOccurrences],
  );

  const saveBill = useCallback(
    async (values: Partial<Bill> & { name: string; amount: number; due_day: number }, id?: string) => {
      if (!user) return false;
      const payload = {
        user_id: user.id,
        name: values.name,
        amount: values.amount,
        category: values.category ?? null,
        due_day: values.due_day,
        periodicity: values.periodicity ?? "monthly",
        is_active: values.is_active ?? true,
      };
      const { error } = id
        ? await db.from("bills").update(payload).eq("id", id)
        : await db.from("bills").insert(payload);
      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        return false;
      }
      // Atualiza as ocorrências pendentes já geradas (valor/nome/categoria)
      if (id) {
        await db
          .from("bill_occurrences")
          .update({ name: payload.name, amount: payload.amount, category: payload.category })
          .eq("bill_id", id)
          .eq("status", "pending");
      }
      toast({ title: id ? "Conta atualizada" : "Conta fixa criada" });
      await refresh();
      return true;
    },
    [user, refresh],
  );

  const deleteBill = useCallback(
    async (id: string) => {
      const { error } = await db.from("bills").delete().eq("id", id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Conta fixa removida" });
      await refresh();
    },
    [refresh],
  );

  /** Conta avulsa: só existe neste mês, não se repete. */
  const addSingleOccurrence = useCallback(
    async (values: { name: string; amount: number; category: string | null; due_date: string }) => {
      if (!user) return false;
      const { error } = await db.from("bill_occurrences").insert({
        user_id: user.id,
        bill_id: null,
        name: values.name,
        amount: values.amount,
        category: values.category,
        due_date: values.due_date,
        period_key: values.due_date.slice(0, 7),
      });
      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: "Conta adicionada" });
      loadOccurrences();
      return true;
    },
    [user, loadOccurrences],
  );

  const updateOccurrence = useCallback(
    async (id: string, values: { name: string; amount: number; category: string | null; due_date: string }) => {
      const { error } = await db
        .from("bill_occurrences")
        .update({ ...values, period_key: values.due_date.slice(0, 7) })
        .eq("id", id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: "Conta atualizada" });
      loadOccurrences();
      return true;
    },
    [loadOccurrences],
  );

  const deleteOccurrence = useCallback(
    async (occ: BillOccurrence) => {
      if (occ.transaction_id) {
        await db.from("transactions").delete().eq("id", occ.transaction_id);
      }
      const { error } = await db.from("bill_occurrences").delete().eq("id", occ.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Conta removida deste mês" });
      loadOccurrences();
    },
    [loadOccurrences],
  );

  return {
    bills,
    occurrences,
    loading,
    today: todayBR(),
    refresh,
    markPaid,
    markPending,
    saveBill,
    deleteBill,
    addSingleOccurrence,
    updateOccurrence,
    deleteOccurrence,
  };
};
