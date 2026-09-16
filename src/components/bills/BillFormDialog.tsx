import { useEffect, useState } from "react";
import { CalendarDays, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BILL_CATEGORIES, Bill, BillOccurrence, PERIODICITY_LABELS, Periodicity, monthRange } from "@/lib/bills";

type Mode = "recurring" | "single";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referenceMonth: Date;
  bill?: Bill | null;
  occurrence?: BillOccurrence | null;
  defaultMode?: Mode;
  onSaveBill: (values: Partial<Bill> & { name: string; amount: number; due_day: number }, id?: string) => Promise<boolean>;
  onSaveOccurrence: (values: { name: string; amount: number; category: string | null; due_date: string }, id?: string) => Promise<boolean>;
}

const parseMoney = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));

export default function BillFormDialog({
  open,
  onOpenChange,
  referenceMonth,
  bill,
  occurrence,
  defaultMode = "single",
  onSaveBill,
  onSaveOccurrence,
}: Props) {
  const editingRecurring = Boolean(bill);
  const editingSingle = Boolean(occurrence);
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Outros");
  const [dueDay, setDueDay] = useState("1");
  const [dueDate, setDueDate] = useState(monthRange(referenceMonth).start);
  const [periodicity, setPeriodicity] = useState<Periodicity>("monthly");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const nextMode: Mode = bill ? "recurring" : occurrence ? "single" : defaultMode;
    setMode(nextMode);
    setName(bill?.name ?? occurrence?.name ?? "");
    setAmount(String(Number(bill?.amount ?? occurrence?.amount ?? 0) || ""));
    setCategory(bill?.category ?? occurrence?.category ?? "Outros");
    setDueDay(String(bill?.due_day ?? 1));
    setDueDate(occurrence?.due_date ?? monthRange(referenceMonth).start);
    setPeriodicity(bill?.periodicity ?? "monthly");
    setIsActive(bill?.is_active ?? true);
  }, [open, bill, occurrence, defaultMode, referenceMonth]);

  const save = async () => {
    const numericAmount = parseMoney(amount);
    if (!name.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return;
    setSaving(true);
    let ok = false;
    if (mode === "recurring") {
      const day = Number(dueDay);
      if (day >= 1 && day <= 31) {
        ok = await onSaveBill({ name: name.trim(), amount: numericAmount, category, due_day: day, periodicity, is_active: isActive }, bill?.id);
      }
    } else {
      ok = await onSaveOccurrence({ name: name.trim(), amount: numericAmount, category, due_date: dueDate }, occurrence?.id);
    }
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  const editing = editingRecurring || editingSingle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            {mode === "recurring" ? "Ela será criada automaticamente nos próximos vencimentos." : "Ela será incluída somente no mês selecionado."}
          </DialogDescription>
        </DialogHeader>

        {!editing && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="single"><CalendarDays className="w-4 h-4 mr-1.5" /> Avulsa</TabsTrigger>
              <TabsTrigger value="recurring"><Repeat2 className="w-4 h-4 mr-1.5" /> Fixa</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="bill-name">Nome</Label>
            <Input id="bill-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Aluguel" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="bill-amount">Valor (R$)</Label>
              <Input id="bill-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BILL_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {mode === "recurring" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bill-day">Dia do vencimento</Label>
                  <Input id="bill-day" type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Periodicidade</Label>
                  <Select value={periodicity} onValueChange={(v) => setPeriodicity(v as Periodicity)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(PERIODICITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {editingRecurring && (
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div><p className="text-sm font-medium">Conta ativa</p><p className="text-xs text-muted-foreground">Cria os próximos vencimentos.</p></div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="bill-date">Vencimento</Label>
              <Input id="bill-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="hero" onClick={save} disabled={saving || !name.trim() || !amount.trim()}>{saving ? "Salvando..." : "Salvar conta"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
