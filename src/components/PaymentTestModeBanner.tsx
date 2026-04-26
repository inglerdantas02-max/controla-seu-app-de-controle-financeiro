const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;

  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
      Pagamentos no preview estão em modo de teste. Use o cartão{" "}
      <span className="font-mono font-medium">4242 4242 4242 4242</span>.
    </div>
  );
}
