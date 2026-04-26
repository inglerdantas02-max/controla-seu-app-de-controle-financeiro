const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;

  return (
    <div className="w-full bg-warning/15 border-b border-warning/30 px-4 py-2 text-center text-sm text-warning-foreground">
      Pagamentos no preview estão em modo de teste. Use o cartão{" "}
      <span className="font-mono font-medium">4242 4242 4242 4242</span>.
    </div>
  );
}
