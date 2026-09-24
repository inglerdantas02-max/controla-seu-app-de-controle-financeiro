import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CreditCard, Pencil, Plus, Repeat2, Trash2 } from "lucide-react";
import { useBills } from "@/hooks/useBills";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import BillFormDialog from "@/components/bills/BillFormDialog";
import BillRow from "@/components/bills/BillRow";
import PayBillDialog from "@/components/bills/PayBillDialog";
import { Bill, BillOccurrence, MONTH_NAMES, PERIODICITY_LABELS, STATE_META, billState, formatBRL, monthLabel, monthRange, summarize } from "@/lib/bills";
import { cn } from "@/lib/utils";

const moveMonth = (date: Date, offset: number) => new Date(date.getFullYear(), date.getMonth() + offset, 1);
type BillFilter = "all" | "paid" | "pending" | "overdue";

const FILTER_LABELS: Record<BillFilter, string> = {
  all: "Todas as contas",
  paid: "Contas pagas",
  pending: "Contas a pagar",
  overdue: "Contas vencidas",
};

const STATE_PRIORITY = {
  overdue: 0,
  today: 1,
  soon: 2,
  upcoming: 3,
  paid: 4,
} as const;

interface Props {
  showHeading?: boolean;
}

export default function BillsManager({ showHeading = true }: Props) {
  const [referenceMonth, setReferenceMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const billsApi = useBills(referenceMonth);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"single" | "recurring">("single");
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingOccurrence, setEditingOccurrence] = useState<BillOccurrence | null>(null);
  const [paying, setPaying] = useState<BillOccurrence | null>(null);
  const [deletingOccurrence, setDeletingOccurrence] = useState<BillOccurrence | null>(null);
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null);
  const [activeTab, setActiveTab] = useState("list");
  const [filter, setFilter] = useState<BillFilter>("all");
  const [timeMarker, setTimeMarker] = useState(() => Date.now());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setTimeMarker(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => summarize(billsApi.occurrences), [billsApi.occurrences]);
  const calendarDays = useMemo(() => {
    const { lastDay } = monthRange(referenceMonth);
    const firstWeekday = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), 1).getDay();
    return Array.from({ length: firstWeekday + lastDay }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  }, [referenceMonth]);
  const byDay = useMemo(() => {
    const map = new Map<number, BillOccurrence[]>();
    for (const occurrence of billsApi.occurrences) {
      const day = Number(occurrence.due_date.slice(8, 10));
      map.set(day, [...(map.get(day) ?? []), occurrence]);
    }
    return map;
  }, [billsApi.occurrences]);
  const filteredOccurrences = useMemo(() => billsApi.occurrences
    .filter((occurrence) => {
      if (filter === "all") return true;
      if (filter === "paid") return occurrence.status === "paid";
      if (filter === "overdue") return billState(occurrence) === "overdue";
      return occurrence.status === "pending";
    })
    .sort((a, b) => {
      const aState = billState(a);
      const bState = billState(b);
      const priorityDifference = STATE_PRIORITY[aState] - STATE_PRIORITY[bState];
      if (priorityDifference !== 0) return priorityDifference;
      if (aState === "overdue") return b.due_date.localeCompare(a.due_date);
      return a.due_date.localeCompare(b.due_date);
    }), [billsApi.occurrences, filter, timeMarker]);

  const openNew = (mode: "single" | "recurring") => {
    setEditingBill(null);
    setEditingOccurrence(null);
    setFormMode(mode);
    setFormOpen(true);
  };

  const showFilteredList = (nextFilter: BillFilter) => {
    setFilter(nextFilter);
    setActiveTab("list");
    window.requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <section aria-labelledby="bills-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        {showHeading && (
          <div>
            <h2 id="bills-heading" className="font-display text-2xl md:text-3xl font-bold">Contas a pagar</h2>
            <p className="text-sm text-muted-foreground mt-1">Acompanhe vencimentos e pagamentos sem sair do painel.</p>
          </div>
        )}
        <div className="flex flex-col xs:flex-row gap-2 sm:items-center sm:ml-auto">
          <div className="flex items-center border border-border rounded-lg bg-card p-1">
            <Button size="icon" variant="ghost" onClick={() => setReferenceMonth((date) => moveMonth(date, -1))} aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></Button>
            <p className="font-semibold text-sm min-w-36 text-center capitalize">{monthLabel(referenceMonth)}</p>
            <Button size="icon" variant="ghost" onClick={() => setReferenceMonth((date) => moveMonth(date, 1))} aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <Button variant="hero" size="sm" onClick={() => openNew("single")}><Plus className="w-4 h-4" /> Nova conta</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Button type="button" variant="ghost" onClick={() => showFilteredList("all")} aria-pressed={filter === "all"} className={cn("h-auto min-h-24 flex-col items-start justify-center bg-card border border-border rounded-lg p-4 text-left transition-shadow hover:bg-card hover:shadow-sm", filter === "all" && "ring-2 ring-foreground/20")}><span className="text-xs font-normal text-muted-foreground">Total do mês</span><span className="font-display text-xl font-bold mt-1">{formatBRL(summary.total)}</span><span className="text-xs font-normal text-muted-foreground mt-1">{summary.count} contas</span></Button>
        <Button type="button" variant="ghost" onClick={() => showFilteredList("paid")} aria-pressed={filter === "paid"} className={cn("h-auto min-h-24 flex-col items-start justify-center bg-success/10 border border-success/20 rounded-lg p-4 text-left transition-shadow hover:bg-success/15 hover:text-success", filter === "paid" && "ring-2 ring-success/40")}><span className="text-xs font-normal text-success">Pagas</span><span className="font-display text-xl font-bold text-success mt-1">{formatBRL(summary.paid)}</span><span className="text-xs font-normal text-success/80 mt-1">{summary.paidCount} concluídas</span></Button>
        <Button type="button" variant="ghost" onClick={() => showFilteredList("pending")} aria-pressed={filter === "pending"} className={cn("h-auto min-h-24 flex-col items-start justify-center bg-primary/10 border border-primary/20 rounded-lg p-4 text-left transition-shadow hover:bg-primary/15 hover:text-primary", filter === "pending" && "ring-2 ring-primary/40")}><span className="text-xs font-normal text-primary">A pagar</span><span className="font-display text-xl font-bold text-primary mt-1">{formatBRL(summary.pending)}</span><span className="text-xs font-normal text-primary/80 mt-1">{summary.pendingCount} pendentes</span></Button>
        <Button type="button" variant="ghost" onClick={() => showFilteredList("overdue")} aria-pressed={filter === "overdue"} className={cn("h-auto min-h-24 flex-col items-start justify-center bg-danger/10 border border-danger/20 rounded-lg p-4 text-left transition-shadow hover:bg-danger/15 hover:text-danger", filter === "overdue" && "ring-2 ring-danger/40")}><span className="text-xs font-normal text-danger">Vencidas</span><span className="font-display text-xl font-bold text-danger mt-1">{formatBRL(summary.overdue)}</span><span className="text-xs font-normal text-danger/80 mt-1">{summary.overdueCount} atrasadas</span></Button>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between text-sm mb-2"><span className="font-medium">Progresso do mês</span><span className="font-semibold">{summary.progress}% pago</span></div>
        <Progress value={summary.progress} className="h-2 bg-muted" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="grid grid-cols-3 w-full sm:w-[480px]">
          <TabsTrigger value="list"><CreditCard className="w-4 h-4 mr-1.5" /> Contas</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarDays className="w-4 h-4 mr-1.5" /> Calendário</TabsTrigger>
          <TabsTrigger value="fixed"><Repeat2 className="w-4 h-4 mr-1.5" /> Fixas</TabsTrigger>
        </TabsList>

        <TabsContent value="list" ref={listRef} className="scroll-mt-4">
          <div className="flex justify-between items-center gap-3 mb-3"><div><h3 className="font-display text-lg sm:text-xl font-bold">{FILTER_LABELS[filter]}</h3><p className="text-xs text-muted-foreground mt-0.5">{MONTH_NAMES[referenceMonth.getMonth()]} de {referenceMonth.getFullYear()}</p></div><Button variant="outline" size="sm" onClick={() => openNew("single")}><Plus className="w-4 h-4" /> Avulsa</Button></div>
          {billsApi.loading ? <p className="text-sm text-muted-foreground py-8">Carregando contas...</p> : billsApi.occurrences.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg py-12 px-6 text-center"><CalendarDays className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="font-semibold">Nenhuma conta neste mês</p><p className="text-sm text-muted-foreground mt-1 mb-4">Adicione uma conta avulsa ou cadastre uma conta fixa.</p><div className="flex flex-wrap justify-center gap-2"><Button variant="hero" onClick={() => openNew("single")}><Plus className="w-4 h-4" /> Avulsa</Button><Button variant="outline" onClick={() => openNew("recurring")}><Repeat2 className="w-4 h-4" /> Fixa</Button></div></div>
          ) : filteredOccurrences.length === 0 ? <div className="border border-dashed border-border rounded-lg py-10 px-6 text-center"><p className="font-semibold">Nenhuma conta neste grupo</p><p className="text-sm text-muted-foreground mt-1">Selecione outro cartão para consultar as demais contas.</p></div> : <ul className="space-y-2">{filteredOccurrences.map((occurrence) => <BillRow key={occurrence.id} occurrence={occurrence} onPay={setPaying} onUndo={billsApi.markPending} onEdit={(item) => { setEditingOccurrence(item); setEditingBill(null); setFormOpen(true); }} onDelete={setDeletingOccurrence} />)}</ul>}
        </TabsContent>

        <TabsContent value="calendar">
          <div className="bg-card border border-border rounded-lg overflow-x-auto">
            <div className="min-w-[560px]">
              <div className="grid grid-cols-7 bg-muted/60 border-b border-border">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">{day}</div>)}</div>
              <div className="grid grid-cols-7">{calendarDays.map((day, index) => {
                const items = day ? byDay.get(day) ?? [] : [];
                return <div key={index} className="min-h-24 border-r border-b border-border p-2">{day && <><p className="text-xs font-medium mb-1">{day}</p><div className="space-y-1">{items.slice(0, 3).map((item) => { const state = billState(item); return <button key={item.id} onClick={() => state === "paid" ? undefined : setPaying(item)} className={cn("w-full text-left text-xs truncate border-l-2 pl-1.5", STATE_META[state].text, state === "paid" ? "border-success line-through" : state === "overdue" ? "border-danger" : "border-primary")}>{item.name}</button>; })}{items.length > 3 && <p className="text-[10px] text-muted-foreground">+{items.length - 3}</p>}</div></>}</div>;
              })}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="fixed">
          <div className="flex justify-between items-center gap-3 mb-3"><div><h3 className="font-display text-lg sm:text-xl font-bold">Contas fixas</h3><p className="text-sm text-muted-foreground">Os próximos vencimentos são gerados automaticamente.</p></div><Button variant="hero" size="sm" onClick={() => openNew("recurring")}><Plus className="w-4 h-4" /> Nova fixa</Button></div>
          {billsApi.bills.length === 0 ? <div className="border border-dashed border-border rounded-lg py-10 text-center text-sm text-muted-foreground">Nenhuma conta fixa cadastrada.</div> : <ul className="space-y-2">{billsApi.bills.map((bill) => <li key={bill.id} className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-semibold truncate">{bill.name}</p>{!bill.is_active && <span className="text-[11px] bg-muted text-muted-foreground rounded-full px-2 py-0.5">Pausada</span>}</div><p className="text-xs text-muted-foreground mt-1">{PERIODICITY_LABELS[bill.periodicity]} • dia {bill.due_day} • {bill.category || "Outros"}</p></div><div className="flex items-center justify-between sm:justify-end gap-1"><p className="font-display font-bold mr-2">{formatBRL(Number(bill.amount))}</p><Button size="icon" variant="ghost" onClick={() => { setEditingBill(bill); setEditingOccurrence(null); setFormOpen(true); }} aria-label={`Editar ${bill.name}`}><Pencil className="w-4 h-4" /></Button><Button size="icon" variant="ghost" className="text-muted-foreground hover:text-danger" onClick={() => setDeletingBill(bill)} aria-label={`Excluir ${bill.name}`}><Trash2 className="w-4 h-4" /></Button></div></li>)}</ul>}
        </TabsContent>
      </Tabs>

      <BillFormDialog open={formOpen} onOpenChange={setFormOpen} referenceMonth={referenceMonth} bill={editingBill} occurrence={editingOccurrence} defaultMode={formMode} onSaveBill={billsApi.saveBill} onSaveOccurrence={(values, id) => id ? billsApi.updateOccurrence(id, values) : billsApi.addSingleOccurrence(values)} />
      <PayBillDialog occurrence={paying} onOpenChange={(open) => { if (!open) setPaying(null); }} onConfirm={billsApi.markPaid} />
      <AlertDialog open={Boolean(deletingOccurrence)} onOpenChange={(open) => { if (!open) setDeletingOccurrence(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir esta conta do mês?</AlertDialogTitle><AlertDialogDescription>A conta fixa continuará gerando os outros meses. Um gasto vinculado a este pagamento também será removido.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (deletingOccurrence) void billsApi.deleteOccurrence(deletingOccurrence); setDeletingOccurrence(null); }}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={Boolean(deletingBill)} onOpenChange={(open) => { if (!open) setDeletingBill(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir conta fixa?</AlertDialogTitle><AlertDialogDescription>Ela deixará de gerar novos vencimentos. As contas já criadas e o histórico de pagamentos serão preservados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (deletingBill) void billsApi.deleteBill(deletingBill.id); setDeletingBill(null); }}>Excluir conta fixa</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </section>
  );
}