import { useEffect, useState } from "react";
import splashLogo from "@/assets/controla-splash.png";

export const SplashScreen = () => {
  const [hidden, setHidden] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1200);
    const hideTimer = setTimeout(() => setHidden(true), 1700);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <img
        src={splashLogo}
        alt="CONTROLA"
        className="w-64 max-w-[70vw] animate-pulse"
      />
    </div>
  );
};
