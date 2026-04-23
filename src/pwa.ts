// PWA service worker registration with safety guards for Lovable preview iframes.
import { registerSW } from "virtual:pwa-register";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovable.dev");

export function setupPWA() {
  if (isPreviewHost || isInIframe) {
    // Avoid SW interference inside the Lovable editor preview.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }
    return;
  }

  if (!("serviceWorker" in navigator)) return;

  registerSW({
    immediate: true,
    onNeedRefresh() {
      // Auto-update: skip waiting + reload to pick up the latest published version.
      window.location.reload();
    },
    onOfflineReady() {
      // No-op: silent offline readiness.
    },
  });
}
