import { useCallback, useEffect, useRef, useState } from "react";

export interface PushToTalkOptions {
  onResult: (audioBase64: string, mimeType: string, durationMs: number) => void;
  onError?: (msg: string) => void;
  minDurationMs?: number; // ignore very short presses
  maxDurationMs?: number; // auto-stop after this
}

export interface PushToTalkApi {
  recording: boolean;
  starting: boolean;
  cancelled: boolean;
  elapsedMs: number;
  level: number; // 0..1 audio level for waveform
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
  setCancelled: (c: boolean) => void;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const c of candidates) {
    try {
      // @ts-ignore
      if (MediaRecorder.isTypeSupported?.(c)) return c;
    } catch {}
  }
  return undefined; // let the browser choose
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const result = r.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function friendlyError(err: any): string {
  const name = err?.name || "";
  const msg = err?.message || "";
  if (name === "NotAllowedError" || /denied|permission/i.test(msg)) {
    return "Permita o uso do microfone para gravar áudio.";
  }
  if (name === "NotFoundError" || /not found|no.*device/i.test(msg)) {
    return "Microfone não encontrado no dispositivo.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "Não consegui acessar o microfone. Feche outros apps que possam estar usando-o.";
  }
  if (name === "SecurityError" || /secure context|https/i.test(msg)) {
    return "O microfone só funciona em conexões seguras (HTTPS).";
  }
  return msg || "Erro ao gravar áudio, tente novamente.";
}

export function usePushToTalk(opts: PushToTalkOptions): PushToTalkApi {
  const { onResult, onError, minDurationMs = 400, maxDurationMs = 60000 } = opts;

  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const cancelRef = useRef(false);
  const mimeRef = useRef<string>("audio/webm");
  const startingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    if (maxTimerRef.current) { window.clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    try { analyserRef.current?.disconnect(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    analyserRef.current = null;
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch {} });
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (startingRef.current || recording) return;
    startingRef.current = true;
    setStarting(true);

    // Pre-checks
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      startingRef.current = false;
      setStarting(false);
      onError?.("Seu navegador não suporta gravação de áudio. Use o Chrome atualizado.");
      return;
    }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      startingRef.current = false;
      setStarting(false);
      onError?.("O microfone só funciona em conexões seguras (HTTPS).");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      startingRef.current = false;
      setStarting(false);
      onError?.("Gravação de áudio não disponível neste navegador.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err: any) {
      startingRef.current = false;
      setStarting(false);
      onError?.(friendlyError(err));
      return;
    }

    try {
      streamRef.current = stream;
      const mime = pickMimeType();
      mimeRef.current = mime || "audio/webm";

      let mr: MediaRecorder;
      try {
        mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch {
        // Fallback without options
        mr = new MediaRecorder(stream);
      }
      // Use whatever the recorder ended up using
      if ((mr as any).mimeType) mimeRef.current = (mr as any).mimeType.split(";")[0] || mimeRef.current;

      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      mr.onerror = (e: any) => {
        onError?.(friendlyError(e?.error || e));
        cleanup();
        setRecording(false);
        setStarting(false);
        startingRef.current = false;
      };
      mr.onstop = async () => {
        const dur = Date.now() - startedAtRef.current;
        const wasCancelled = cancelRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        cleanup();
        setRecording(false);
        setStarting(false);
        startingRef.current = false;
        setLevel(0);
        setElapsedMs(0);
        if (wasCancelled) return;
        if (dur < minDurationMs || blob.size < 800) {
          onError?.("Gravação muito curta. Segure para falar.");
          return;
        }
        try {
          const b64 = await blobToBase64(blob);
          onResult(b64, mimeRef.current, dur);
        } catch (err: any) {
          onError?.(err?.message || "Falha ao processar áudio");
        }
      };

      // Audio level analyser (best-effort, never blocks recording)
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) {
          const ctx: AudioContext = new Ctx();
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
          const buf = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!analyserRef.current) return;
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            setLevel(Math.min(1, rms * 2.5));
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }
      } catch {}

      cancelRef.current = false;
      setCancelled(false);
      startedAtRef.current = Date.now();
      mediaRecorderRef.current = mr;
      mr.start(100);
      setRecording(true);
      setStarting(false);
      startingRef.current = false;
      setElapsedMs(0);
      tickRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 100);
      // Auto-stop safety
      maxTimerRef.current = window.setTimeout(() => {
        try {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        } catch {}
      }, maxDurationMs);
    } catch (err: any) {
      onError?.(friendlyError(err));
      cleanup();
      setRecording(false);
      setStarting(false);
      startingRef.current = false;
    }
  }, [recording, onResult, onError, minDurationMs, maxDurationMs, cleanup]);

  const stop = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      cancelRef.current = false;
      try { mr.stop(); } catch {}
    } else {
      cleanup();
      setRecording(false);
      setStarting(false);
      startingRef.current = false;
    }
  }, [cleanup]);

  const cancel = useCallback(() => {
    const mr = mediaRecorderRef.current;
    cancelRef.current = true;
    setCancelled(true);
    if (mr && mr.state !== "inactive") {
      try { mr.stop(); } catch {}
    } else {
      cleanup();
      setRecording(false);
      setStarting(false);
      startingRef.current = false;
    }
  }, [cleanup]);

  return { recording, starting, cancelled, elapsedMs, level, start, stop, cancel, setCancelled };
}
