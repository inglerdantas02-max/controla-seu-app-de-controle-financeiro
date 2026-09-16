export type Periodicity = "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string | null;
  due_day: number;
  periodicity: Periodicity;
  is_active: boolean;
  start_date: string;
}

export interface BillOccurrence {
  id: string;
  user_id: string;
  bill_id: string | null;
  name: string;
  amount: number;
  category: string | null;
  due_date: string; // YYYY-MM-DD
  period_key: string; // YYYY-MM
  status: "pending" | "paid";
  paid_at: string | null;
  transaction_id: string | null;
}

export const PERIODICITY_LABELS: Record<Periodicity, string> = {
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export const BILL_CATEGORIES = [
  "Moradia",
  "Transporte",
  "Alimentação",
  "Saúde",
  "Educação",
  "Lazer",
  "Serviços",
  "Financeiro",
  "Outros",
];

export const formatBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Data de hoje no fuso de Brasília, como YYYY-MM-DD */
export const todayBR = (): string => {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
};

export const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const monthRange = (d: Date) => {
  const start = `${monthKey(d)}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const end = `${monthKey(d)}-${String(last).padStart(2, "0")}`;
  return { start, end, lastDay: last };
};

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const monthLabel = (d: Date) => `${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;

export const formatDueDate = (isoDate: string) => {
  const [y, m, dd] = isoDate.split("-");
  return `${dd}/${m}/${y}`;
};

export const daysUntil = (isoDate: string) => {
  const a = new Date(`${todayBR()}T00:00:00`);
  const b = new Date(`${isoDate}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

export type BillState = "paid" | "overdue" | "today" | "soon" | "upcoming";

export const billState = (o: BillOccurrence): BillState => {
  if (o.status === "paid") return "paid";
  const diff = daysUntil(o.due_date);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "upcoming";
};

export const STATE_META: Record<BillState, { label: string; dot: string; chip: string; text: string }> = {
  paid: {
    label: "Paga",
    dot: "bg-success",
    chip: "bg-success/15 text-success border-success/30",
    text: "text-success",
  },
  overdue: {
    label: "Vencida",
    dot: "bg-danger",
    chip: "bg-danger/15 text-danger border-danger/30",
    text: "text-danger",
  },
  today: {
    label: "Vence hoje",
    dot: "bg-yellow-500",
    chip: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    text: "text-yellow-600",
  },
  soon: {
    label: "Vence em breve",
    dot: "bg-primary",
    chip: "bg-primary/15 text-primary border-primary/30",
    text: "text-primary",
  },
  upcoming: {
    label: "A vencer",
    dot: "bg-muted-foreground/50",
    chip: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
  },
};

export const summarize = (occurrences: BillOccurrence[]) => {
  let total = 0, paid = 0, pending = 0, overdue = 0, overdueCount = 0, pendingCount = 0, paidCount = 0;
  for (const o of occurrences) {
    const amt = Number(o.amount);
    total += amt;
    if (o.status === "paid") {
      paid += amt;
      paidCount++;
    } else {
      pending += amt;
      pendingCount++;
      if (daysUntil(o.due_date) < 0) {
        overdue += amt;
        overdueCount++;
      }
    }
  }
  return {
    total,
    paid,
    pending,
    overdue,
    paidCount,
    pendingCount,
    overdueCount,
    count: occurrences.length,
    progress: total > 0 ? Math.round((paid / total) * 100) : 0,
  };
};
