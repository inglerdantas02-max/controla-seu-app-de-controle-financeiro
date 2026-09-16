import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BillOccurrence, formatBRL } from "@/lib/bills";

interface Props {
  occurrence: BillOccurrence | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (occ: BillOccurrence, createExpense: boolean) => Promise<void>;
}

export default function PayBillDialog({ occurrence, onOpenChange, onConfirm }: Props) {
  const [createExpense, setCreateExpense] = useState(true);
  const [saving, setSaving] = useState(false);
  if (!occurrence) return null;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Confirmar pagamento</DialogTitle>
          <DialogDescription>{occurrence.name} • {formatBRL(Number(occurrence.amount))}</DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-lg border border-border p-4">
          <Checkbox id="create-expense" checked={createExpense} onCheckedChange={(v) => setCreateExpense(v === true)} />
          <div className="space-y-1"><Label htmlFor="create-expense" className="cursor-pointer">Registrar também como gasto</Label><p className="text-xs text-muted-foreground">Cria uma única movimentação vinculada a esta conta.</p></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="success" disabled={saving} onClick={async () => { setSaving(true); await onConfirm(occurrence, createExpense); setSaving(false); onOpenChange(false); }}>{saving ? "Salvando..." : "Marcar como paga"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
