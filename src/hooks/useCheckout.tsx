import { createContext, useContext, useState, ReactNode } from "react";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { useAuth } from "@/hooks/useAuth";

interface CheckoutCtx {
  openCheckout: () => void;
}

const Ctx = createContext<CheckoutCtx>({ openCheckout: () => {} });

export const CheckoutProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <Ctx.Provider value={{ openCheckout: () => setOpen(true) }}>
      {children}
      <CheckoutDialog
        open={open}
        onOpenChange={setOpen}
        customerEmail={user?.email}
        userId={user?.id}
        returnUrl={`${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`}
      />
    </Ctx.Provider>
  );
};

export const useCheckout = () => useContext(Ctx);
