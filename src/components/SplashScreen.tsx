import { useEffect, useState } from "react";

export const SplashScreen = () => {
  const [hidden, setHidden] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 1200);
    const hideTimer = setTimeout(() => setHidden(true), 1700);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ backgroundColor: "#6C63FF" }}
    >
      <div className="flex flex-col items-center gap-6 animate-pulse">
        <img
          src="/pwa-512.png"
          alt="CONTROLA"
          width={112}
          height={112}
          className="w-28 h-28 rounded-3xl shadow-2xl"
        />
        <h1 className="text-white text-3xl font-bold tracking-widest">
          CONTROLA
        </h1>
      </div>
    </div>
  );
};
