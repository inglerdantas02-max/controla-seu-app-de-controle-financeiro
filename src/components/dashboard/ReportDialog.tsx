import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface Tx {
  id: string;
  type: string;
  amount: number;
  category: string | null;
  occurred_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  txs: Tx[];
  periodLabel: string;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ReportDialog = ({ open, onOpenChange, txs, periodLabel }: Props) => {
  const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  const byCategory = new Map<string, number>();
  txs.filter((t) => t.type === "expense").forEach((t) => {
    const k = t.category || "Outros";
    byCategory.set(k, (byCategory.get(k) ?? 0) + Number(t.amount));
  });
  const topCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const exportPDF = () => {
    const html = `
      <html><head><title>Relatório CONTROLA - ${periodLabel}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:40px;max-width:700px;margin:auto;color:#111}
        h1{font-size:28px;margin-bottom:4px}
        .sub{color:#666;margin-bottom:32px}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px}
        .card{border:1px solid #e5e5e5;border-radius:12px;padding:16px}
        .label{font-size:12px;color:#666}
        .value{font-size:22px;font-weight:700;margin-top:4px}
        .green{color:#16a34a}.red{color:#dc2626}
        h2{font-size:18px;margin-top:24px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        td,th{text-align:left;padding:8px;border-bottom:1px solid #eee;font-size:14px}
      </style></head><body>
      <h1>Relatório Financeiro</h1>
      <p class="sub">CONTROLA • ${periodLabel}</p>
      <div class="grid">
        <div class="card"><div class="label">Saldo</div><div class="value">${formatBRL(balance)}</div></div>
        <div class="card"><div class="label">Entradas</div><div class="value green">${formatBRL(income)}</div></div>
        <div class="card"><div class="label">Saídas</div><div class="value red">${formatBRL(expense)}</div></div>
      </div>
      <h2>Top categorias de gasto</h2>
      <table><thead><tr><th>Categoria</th><th>Total</th></tr></thead><tbody>
      ${topCategories.map(([c, v]) => `<tr><td>${c}</td><td>${formatBRL(v)}</td></tr>`).join("") || '<tr><td colspan="2">Sem dados</td></tr>'}
      </tbody></table>
      <h2>Movimentações (${txs.length})</h2>
      <table><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>
      ${txs.map((t) => `<tr><td>${new Date(t.occurred_at).toLocaleDateString("pt-BR")}</td><td>${t.type === "income" ? "Entrada" : "Saída"}</td><td>${t.category || "-"}</td><td>${formatBRL(Number(t.amount))}</td></tr>`).join("")}
      </tbody></table>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Relatório • {periodLabel}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gradient-primary text-primary-foreground p-3 rounded-2xl">
            <Wallet className="w-4 h-4 mb-1 opacity-80" />
            <p className="text-xs opacity-80">Saldo</p>
            <p className="font-display font-bold text-sm">{formatBRL(balance)}</p>
          </div>
          <div className="bg-success/10 p-3 rounded-2xl">
            <TrendingUp className="w-4 h-4 mb-1 text-success" />
            <p className="text-xs text-muted-foreground">Entradas</p>
            <p className="font-display font-bold text-sm text-success">{formatBRL(income)}</p>
          </div>
          <div className="bg-danger/10 p-3 rounded-2xl">
            <TrendingDown className="w-4 h-4 mb-1 text-danger" />
            <p className="text-xs text-muted-foreground">Saídas</p>
            <p className="font-display font-bold text-sm text-danger">{formatBRL(expense)}</p>
          </div>
        </div>

        <div>
          <h3 className="font-display font-bold mb-2 mt-2">Categorias com mais gasto</h3>
          {topCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem gastos no período.</p>
          ) : (
            <ul className="space-y-2">
              {topCategories.map(([cat, val]) => {
                const pct = expense > 0 ? (val / expense) * 100 : 0;
                return (
                  <li key={cat} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{cat}</span>
                      <span className="text-muted-foreground">{formatBRL(val)} • {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          Total de movimentações: <span className="font-semibold text-foreground">{txs.length}</span>
        </div>

        <Button onClick={exportPDF} variant="hero" className="w-full">
          <Download className="w-4 h-4" /> Exportar PDF
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
