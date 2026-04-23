import { useCallback, useEffect, useRef, useState } from "react";

export interface PushToTalkOptions {
  onResult: (audioBase64: string, mimeType: string, durationMs: number) => void;
  onError?: (msg: string) => void;
  minDurationMs?: number; // ignore very short presses
}

export interface PushToTalkApi {
  recording: boolean;
  cancelled: boolean;
  elapsedMs: number;
  level: number; // 0..1 audio level for waveform
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
  setCancelled: (c: boolean) => void;
}

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const c of candidates) {
    // @ts-ignore
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "audio/webm";
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

export function usePushToTalk(opts: PushToTalkOptions): PushToTalkApi {
  const { onResult, onError, minDurationMs = 400 } = opts;

  const [recording, setRecording] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const cancelRef = useRef(false);
  const mimeRef = useRef<string>("audio/webm");

  const cleanup = useCallback(() => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    try { analyserRef.current?.disconnect(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    analyserRef.current = null;
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mime = pickMimeType();
      mimeRef.current = mime;
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const dur = Date.now() - startedAtRef.current;
        const wasCancelled = cancelRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        cleanup();
        setRecording(false);
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

      // Audio level analyser
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new Ctx();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
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
      } catch {}

      cancelRef.current = false;
      setCancelled(false);
      startedAtRef.current = Date.now();
      mediaRecorderRef.current = mr;
      mr.start(100);
      setRecording(true);
      setElapsedMs(0);
      tickRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 100);
    } catch (err: any) {
      onError?.(err?.message || "Permissão de microfone negada");
      cleanup();
      setRecording(false);
    }
  }, [recording, onResult, onError, minDurationMs, cleanup]);

  const stop = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      cancelRef.current = false;
      try { mr.stop(); } catch {}
    } else {
      cleanup();
      setRecording(false);
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
    }
  }, [cleanup]);

  return { recording, cancelled, elapsedMs, level, start, stop, cancel, setCancelled };
}
