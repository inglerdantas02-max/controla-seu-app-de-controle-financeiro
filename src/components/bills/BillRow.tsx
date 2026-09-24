import { Check, MoreVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BillOccurrence, STATE_META, billState, formatBRL, formatDueDate } from "@/lib/bills";
import { cn } from "@/lib/utils";

interface Props {
  occurrence: BillOccurrence;
  onPay: (occ: BillOccurrence) => void;
  onUndo: (occ: BillOccurrence) => void;
  onEdit: (occ: BillOccurrence) => void;
  onDelete: (occ: BillOccurrence) => void;
}

export default function BillRow({ occurrence, onPay, onUndo, onEdit, onDelete }: Props) {
  const state = billState(occurrence);
  const meta = STATE_META[state];
  return (
    <li className={cn(
      "border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm transition-colors",
      state === "overdue" && "bg-danger/15 border-danger/40",
      (state === "today" || state === "soon") && "bg-warning/20 border-warning/50",
      state === "upcoming" && "bg-secondary/10 border-secondary/30",
      state === "paid" && "bg-success/10 border-success/30",
    )}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span className={cn("mt-1.5 w-2.5 h-2.5 rounded-full shrink-0", meta.dot)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("font-semibold truncate", state === "paid" && "line-through text-muted-foreground")}>{occurrence.name}</p>
            <span className={cn("border rounded-full px-2 py-0.5 text-[11px] font-medium", meta.chip)}>{meta.label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{occurrence.category || "Outros"} • vence em {formatDueDate(occurrence.due_date)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
        <p className={cn("font-display font-bold", state === "overdue" && "text-danger")}>{formatBRL(Number(occurrence.amount))}</p>
        {state === "paid" ? (
          <Button size="sm" variant="outline" onClick={() => onUndo(occurrence)}><RotateCcw className="w-4 h-4" /> Desfazer</Button>
        ) : (
          <Button size="sm" variant="success" onClick={() => onPay(occurrence)}><Check className="w-4 h-4" /> Pagar</Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9" aria-label={`Opções de ${occurrence.name}`}><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(occurrence)}>Editar neste mês</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-danger focus:text-danger" onClick={() => onDelete(occurrence)}>Excluir deste mês</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
