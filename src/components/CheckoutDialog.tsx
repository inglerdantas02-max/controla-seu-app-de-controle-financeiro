import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

type Months = 1 | 3 | 6 | 12;
type PaymentMethod = "any" | "card" | "pix";

const PERIODS: { months: Months; label: string; badge?: string }[] = [
  { months: 1, label: "1 mês" },
  { months: 3, label: "3 meses" },
  { months: 6, label: "6 meses" },
  { months: 12, label: "1 ano", badge: "Melhor valor" },
];

const MONTHLY_PRICE = 19.9;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerEmail?: string;
  userId?: string;
  returnUrl?: string;
}

export function CheckoutDialog({ open, onOpenChange, customerEmail, userId, returnUrl }: Props) {
  const [months, setMonths] = useState<Months | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("any");
  const [confirmed, setConfirmed] = useState(false);

  // Reset when dialog closes
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setMonths(null);
      setPaymentMethod("any");
      setConfirmed(false);
    }
    onOpenChange(v);
  };

  const fetchClientSecret = useMemo(() => {
    if (!confirmed || !months) return null;
    return async (): Promise<string> => {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          months,
          paymentMethod: paymentMethod === "any" ? undefined : paymentMethod,
          customerEmail,
          userId,
          returnUrl:
            returnUrl ||
            `${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          environment: getStripeEnvironment(),
        },
      });
      if (error || !data?.clientSecret) {
        throw new Error(error?.message || "Failed to create checkout session");
      }
      return data.clientSecret;
    };
  }, [confirmed, months, paymentMethod, customerEmail, userId, returnUrl]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Assinar CONTROLA PRO</DialogTitle>
        </DialogHeader>

        {!confirmed && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Escolha o período</h3>
              <div className="grid grid-cols-2 gap-3">
                {PERIODS.map((p) => {
                  const total = MONTHLY_PRICE * p.months;
                  const selected = months === p.months;
                  return (
                    <button
                      key={p.months}
                      type="button"
                      onClick={() => setMonths(p.months)}
                      className={`relative text-left rounded-2xl border p-4 transition ${
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {p.badge && (
                        <span className="absolute -top-2 right-3 text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          {p.badge}
                        </span>
                      )}
                      <div className="font-semibold">{p.label}</div>
                      <div className="text-2xl font-display font-bold mt-1">
                        R$ {total.toFixed(2).replace(".", ",")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        equivale a R$ {MONTHLY_PRICE.toFixed(2).replace(".", ",")}/mês
                      </div>
                      {selected && (
                        <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Forma de pagamento</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "any" as const, label: "Cartão ou Pix" },
                  { id: "card" as const, label: "Cartão" },
                  { id: "pix" as const, label: "Pix" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      paymentMethod === opt.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setConfirmed(true)}
              disabled={!months}
              size="lg"
              className="w-full"
            >
              Continuar para pagamento
            </Button>
          </div>
        )}

        {confirmed && fetchClientSecret && (
          <div id="checkout" className="p-2">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
