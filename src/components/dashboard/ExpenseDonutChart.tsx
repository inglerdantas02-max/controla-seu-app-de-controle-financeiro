import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartPie } from "lucide-react";

interface ExpenseItem {
  amount: number;
  category: string | null;
}

interface ExpenseDonutChartProps {
  expenses: ExpenseItem[];
  periodLabel: string;
}

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
];

export default function ExpenseDonutChart({ expenses, periodLabel }: ExpenseDonutChartProps) {
  const byCategory = expenses.reduce<Record<string, number>>((acc, item) => {
    const category = item.category?.trim() || "Outros";
    acc[category] = (acc[category] || 0) + Number(item.amount);
    return acc;
  }, {});

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const visible = sorted.slice(0, 6).map(([name, value]) => ({ name, value }));
  const remaining = sorted.slice(6).reduce((sum, [, value]) => sum + value, 0);
  if (remaining > 0) visible.push({ name: "Outras categorias", value: remaining });

  const total = visible.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="mb-8 bg-card border border-border rounded-lg p-5 md:p-6" aria-labelledby="expense-chart-title">
      <div className="flex items-center gap-2 mb-1">
        <ChartPie className="w-5 h-5 text-primary" />
        <h2 id="expense-chart-title" className="font-display text-xl font-bold">Despesas por categoria</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Distribuição dos gastos • {periodLabel.toLowerCase()}</p>

      {total === 0 ? (
        <div className="min-h-56 border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center px-5">
          <ChartPie className="w-10 h-10 text-muted-foreground/50 mb-3" />
          <p className="font-medium">Nenhuma despesa neste período</p>
          <p className="text-sm text-muted-foreground mt-1">O gráfico aparecerá após o primeiro gasto registrado.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[minmax(260px,0.9fr)_minmax(280px,1.1fr)] gap-6 items-center">
          <div
            className="relative h-64 w-full max-w-sm mx-auto"
            role="img"
            aria-label={`Gráfico circular das despesas de ${periodLabel.toLowerCase()}, total ${formatBRL(total)}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visible}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={104}
                  paddingAngle={2}
                  stroke="hsl(var(--card))"
                  strokeWidth={3}
                  isAnimationActive
                >
                  {visible.map((item, index) => (
                    <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatBRL(Number(value)), "Gasto"]}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-20 text-center">
              <span className="text-xs text-muted-foreground">Total</span>
              <strong className="font-display text-lg leading-tight mt-1">{formatBRL(total)}</strong>
            </div>
          </div>

          <ul className="space-y-3" aria-label="Legenda das despesas por categoria">
            {visible.map((item, index) => {
              const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <li key={item.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatBRL(item.value)}</p>
                    <p className="text-xs text-muted-foreground">{percentage}%</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}