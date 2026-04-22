import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = any;

export interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition(opts: {
  lang?: string;
  onResult: (text: string) => void;
  onError?: (msg: string) => void;
}): UseSpeechRecognitionResult {
  const { lang = "pt-BR", onResult, onError } = opts;
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const SR =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  const supported = !!SR;

  useEffect(() => {
    if (!SR) return;
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript?.trim();
      if (text) onResult(text);
      else onError?.("Não consegui entender, tente novamente");
    };
    rec.onerror = (e: any) => {
      const code = e.error;
      if (code === "no-speech") onError?.("Não consegui entender, tente novamente");
      else if (code === "not-allowed") onError?.("Permissão de microfone negada");
      else onError?.("Erro ao reconhecer voz");
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch {}
      recognitionRef.current = null;
    };
  }, [SR, lang, onResult, onError]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || listening) return;
    try {
      rec.start();
      setListening(true);
    } catch {
      // already started
    }
  }, [listening]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try { rec.stop(); } catch {}
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}
