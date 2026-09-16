import { useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, CreditCard, Pencil, Plus, Repeat2, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useBills } from "@/hooks/useBills";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import BillFormDialog from "@/components/bills/BillFormDialog";
import BillRow from "@/components/bills/BillRow";
import PayBillDialog from "@/components/bills/PayBillDialog";
import Paywall from "@/pages/Paywall";
import logo from "@/assets/logo.png";
import { Bill, BillOccurrence, MONTH_NAMES, PERIODICITY_LABELS, STATE_META, billState, formatBRL, monthLabel, monthRange, summarize } from "@/lib/bills";
import { cn } from "@/lib/utils";

const moveMonth = (date: Date, offset: number) => new Date(date.getFullYear(), date.getMonth() + offset, 1);

export default function Bills() {
  const { user, loading: authLoading } = useAuth();
  const { isBlocked, loading: subLoading } = useSubscription();
  const [referenceMonth, setReferenceMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const billsApi = useBills(referenceMonth);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"single" | "recurring">("single");
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingOccurrence, setEditingOccurrence] = useState<BillOccurrence | null>(null);
  const [paying, setPaying] = useState<BillOccurrence | null>(null);
  const [deletingOccurrence, setDeletingOccurrence] = useState<BillOccurrence | null>(null);
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null);

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

  if (authLoading || subLoading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isBlocked) return <Paywall />;

  const openNew = (mode: "single" | "recurring") => {
    setEditingBill(null);
    setEditingOccurrence(null);
    setFormMode(mode);
    setFormOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <nav className="border-b border-border bg-background/90 backdrop-blur sticky top-0 z-30">
        <div className="container h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link to="/dashboard" aria-label="Voltar ao painel"><ArrowLeft className="w-5 h-5" /></Link></Button>
            <Link to="/dashboard" className="flex items-center gap-2"><img src={logo} alt="CONTROLA" className="w-8 h-8 rounded-lg" /><span className="font-display font-bold">CONTROLA</span></Link>
          </div>
          <Button variant="hero" size="sm" onClick={() => openNew("single")}><Plus className="w-4 h-4" /> Nova conta</Button>
        </div>
      </nav>

      <main className="container py-7 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div><h1 className="font-display text-3xl font-bold">Contas a pagar</h1><p className="text-sm text-muted-foreground mt-1">Acompanhe vencimentos e pagamentos sem perder nenhuma conta.</p></div>
          <div className="flex items-center border border-border rounded-lg bg-card p-1 self-start">
            <Button size="icon" variant="ghost" onClick={() => setReferenceMonth((d) => moveMonth(d, -1))} aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></Button>
            <p className="font-semibold text-sm min-w-40 text-center capitalize">{monthLabel(referenceMonth)}</p>
            <Button size="icon" variant="ghost" onClick={() => setReferenceMonth((d) => moveMonth(d, 1))} aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-card border border-border rounded-lg p-4"><p className="text-xs text-muted-foreground">Total do mês</p><p className="font-display text-xl font-bold mt-1">{formatBRL(summary.total)}</p><p className="text-xs text-muted-foreground mt-1">{summary.count} contas</p></div>
          <div className="bg-success/10 border border-success/20 rounded-lg p-4"><p className="text-xs text-success">Pagas</p><p className="font-display text-xl font-bold text-success mt-1">{formatBRL(summary.paid)}</p><p className="text-xs text-success/80 mt-1">{summary.paidCount} concluídas</p></div>
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4"><p className="text-xs text-primary">A pagar</p><p className="font-display text-xl font-bold text-primary mt-1">{formatBRL(summary.pending)}</p><p className="text-xs text-primary/80 mt-1">{summary.pendingCount} pendentes</p></div>
          <div className="bg-danger/10 border border-danger/20 rounded-lg p-4"><p className="text-xs text-danger">Vencidas</p><p className="font-display text-xl font-bold text-danger mt-1">{formatBRL(summary.overdue)}</p><p className="text-xs text-danger/80 mt-1">{summary.overdueCount} atrasadas</p></div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between text-sm mb-2"><span className="font-medium">Progresso do mês</span><span className="font-semibold">{summary.progress}% pago</span></div>
          <Progress value={summary.progress} className="h-2 bg-muted" />
        </div>

        <Tabs defaultValue="list" className="space-y-5">
          <TabsList className="grid grid-cols-3 w-full sm:w-[480px]">
            <TabsTrigger value="list"><CreditCard className="w-4 h-4 mr-1.5" /> Contas</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarDays className="w-4 h-4 mr-1.5" /> Calendário</TabsTrigger>
            <TabsTrigger value="fixed"><Repeat2 className="w-4 h-4 mr-1.5" /> Fixas</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <div className="flex justify-between items-center mb-3"><h2 className="font-display text-xl font-bold">Vencimentos de {MONTH_NAMES[referenceMonth.getMonth()].toLowerCase()}</h2><Button variant="outline" size="sm" onClick={() => openNew("single")}><Plus className="w-4 h-4" /> Avulsa</Button></div>
            {billsApi.loading ? <p className="text-sm text-muted-foreground py-8">Carregando contas...</p> : billsApi.occurrences.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg py-12 px-6 text-center"><CalendarDays className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="font-semibold">Nenhuma conta neste mês</p><p className="text-sm text-muted-foreground mt-1 mb-4">Adicione uma conta avulsa ou cadastre uma conta fixa.</p><div className="flex justify-center gap-2"><Button variant="hero" onClick={() => openNew("single")}><Plus className="w-4 h-4" /> Avulsa</Button><Button variant="outline" onClick={() => openNew("recurring")}><Repeat2 className="w-4 h-4" /> Fixa</Button></div></div>
            ) : <ul className="space-y-2">{billsApi.occurrences.map((occ) => <BillRow key={occ.id} occurrence={occ} onPay={setPaying} onUndo={billsApi.markPending} onEdit={(item) => { setEditingOccurrence(item); setEditingBill(null); setFormOpen(true); }} onDelete={setDeletingOccurrence} />)}</ul>}
          </TabsContent>

          <TabsContent value="calendar">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-7 bg-muted/60 border-b border-border">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}</div>
              <div className="grid grid-cols-7">{calendarDays.map((day, index) => {
                const items = day ? byDay.get(day) ?? [] : [];
                return <div key={index} className="min-h-20 sm:min-h-24 border-r border-b border-border p-1.5 sm:p-2 last:border-r-0">{day && <><p className="text-xs font-medium mb-1">{day}</p><div className="space-y-1">{items.slice(0, 3).map((item) => { const state = billState(item); return <button key={item.id} onClick={() => state === "paid" ? undefined : setPaying(item)} className={cn("w-full text-left text-[10px] sm:text-xs truncate border-l-2 pl-1.5", STATE_META[state].text, state === "paid" ? "border-success line-through" : state === "overdue" ? "border-danger" : "border-primary")}>{item.name}</button>; })}{items.length > 3 && <p className="text-[10px] text-muted-foreground">+{items.length - 3}</p>}</div></>}</div>;
              })}</div>
            </div>
          </TabsContent>

          <TabsContent value="fixed">
            <div className="flex justify-between items-center mb-3"><div><h2 className="font-display text-xl font-bold">Contas fixas</h2><p className="text-sm text-muted-foreground">Os próximos vencimentos são gerados automaticamente.</p></div><Button variant="hero" size="sm" onClick={() => openNew("recurring")}><Plus className="w-4 h-4" /> Nova fixa</Button></div>
            {billsApi.bills.length === 0 ? <div className="border border-dashed border-border rounded-lg py-10 text-center text-sm text-muted-foreground">Nenhuma conta fixa cadastrada.</div> : <ul className="space-y-2">{billsApi.bills.map((bill) => <li key={bill.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-semibold truncate">{bill.name}</p>{!bill.is_active && <span className="text-[11px] bg-muted text-muted-foreground rounded-full px-2 py-0.5">Pausada</span>}</div><p className="text-xs text-muted-foreground mt-1">{PERIODICITY_LABELS[bill.periodicity]} • dia {bill.due_day} • {bill.category || "Outros"}</p></div><div className="flex items-center gap-1"><p className="font-display font-bold mr-2">{formatBRL(Number(bill.amount))}</p><Button size="icon" variant="ghost" onClick={() => { setEditingBill(bill); setEditingOccurrence(null); setFormOpen(true); }} aria-label={`Editar ${bill.name}`}><Pencil className="w-4 h-4" /></Button><Button size="icon" variant="ghost" className="text-muted-foreground hover:text-danger" onClick={() => setDeletingBill(bill)} aria-label={`Excluir ${bill.name}`}><Trash2 className="w-4 h-4" /></Button></div></li>)}</ul>}
          </TabsContent>
        </Tabs>
      </main>

      <BillFormDialog open={formOpen} onOpenChange={setFormOpen} referenceMonth={referenceMonth} bill={editingBill} occurrence={editingOccurrence} defaultMode={formMode} onSaveBill={billsApi.saveBill} onSaveOccurrence={(values, id) => id ? billsApi.updateOccurrence(id, values) : billsApi.addSingleOccurrence(values)} />
      <PayBillDialog occurrence={paying} onOpenChange={(open) => { if (!open) setPaying(null); }} onConfirm={billsApi.markPaid} />
      <AlertDialog open={Boolean(deletingOccurrence)} onOpenChange={(open) => { if (!open) setDeletingOccurrence(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir esta conta do mês?</AlertDialogTitle><AlertDialogDescription>A conta fixa continuará gerando os outros meses. Um gasto vinculado a este pagamento também será removido.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (deletingOccurrence) void billsApi.deleteOccurrence(deletingOccurrence); setDeletingOccurrence(null); }}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={Boolean(deletingBill)} onOpenChange={(open) => { if (!open) setDeletingBill(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir conta fixa?</AlertDialogTitle><AlertDialogDescription>Ela deixará de gerar novos vencimentos. As contas já criadas e o histórico de pagamentos serão preservados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (deletingBill) void billsApi.deleteBill(deletingBill.id); setDeletingBill(null); }}>Excluir conta fixa</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
