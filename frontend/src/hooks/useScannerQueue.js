// useScannerQueue.js
//
// Hook compartido para los escáneres QR (Asistencia, Movilidad, PAE).
//
// Resuelve la race condition donde QRs detectados mientras procesa otro
// eran descartados silenciosamente.
//
// Soporta 2 modos:
//   - "auto"   → encola y procesa uno por uno en orden de llegada (default)
//   - "manual" → para tras cada escaneo; requiere processNext() del usuario
//
// Uso:
//   const { enqueue, queueSize, processing, mode, setMode, processNext, clear } =
//     useScannerQueue({ onProcess: async (token) => api.post(...), cooldownMs: 30000 });
//
//   <Scanner onScan={(codes) => enqueue(codes[0].rawValue)} />
//
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_COOLDOWN_MS = 30000; // 30s anti-duplicado del mismo QR

export function useScannerQueue({ onProcess, cooldownMs = DEFAULT_COOLDOWN_MS, onEnqueued, onIgnoredDuplicate } = {}) {
  const [mode, setMode] = useState("auto"); // "auto" | "manual"
  const [queueSize, setQueueSize] = useState(0);
  const [processing, setProcessing] = useState(false);

  // Refs para no romper closures
  const queueRef = useRef([]);              // FIFO de tokens pendientes
  const processingRef = useRef(false);      // ¿hay un escaneo en vuelo?
  const lastSeenRef = useRef(new Map());    // token -> timestamp última vez procesado
  const modeRef = useRef(mode);
  const onProcessRef = useRef(onProcess);
  const onEnqueuedRef = useRef(onEnqueued);
  const onIgnoredDuplicateRef = useRef(onIgnoredDuplicate);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { onProcessRef.current = onProcess; }, [onProcess]);
  useEffect(() => { onEnqueuedRef.current = onEnqueued; }, [onEnqueued]);
  useEffect(() => { onIgnoredDuplicateRef.current = onIgnoredDuplicate; }, [onIgnoredDuplicate]);

  const refreshSize = useCallback(() => setQueueSize(queueRef.current.length), []);

  const runOne = useCallback(async (token) => {
    processingRef.current = true;
    setProcessing(true);
    try {
      lastSeenRef.current.set(token, Date.now());
      const fn = onProcessRef.current;
      if (fn) await fn(token);
    } catch {
      // Errors are handled inside onProcess by the caller
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, []);

  // Bucle de drenaje (modo auto)
  const drain = useCallback(async () => {
    if (processingRef.current) return;
    while (queueRef.current.length > 0 && modeRef.current === "auto") {
      const token = queueRef.current.shift();
      refreshSize();
      await runOne(token);
    }
    // Para modo manual: si quedan tokens en cola, los conservamos en queueRef
    refreshSize();
  }, [runOne, refreshSize]);

  // Encolar (llamar desde onScan)
  const enqueue = useCallback((token) => {
    if (!token || typeof token !== "string") return;

    // Anti-duplicado por token con cooldown
    const last = lastSeenRef.current.get(token);
    if (last && Date.now() - last < cooldownMs) {
      onIgnoredDuplicateRef.current?.(token);
      return;
    }
    // Evitar encolar el mismo token dos veces seguidas si ya está en la cola
    if (queueRef.current.includes(token)) return;

    queueRef.current.push(token);
    refreshSize();
    onEnqueuedRef.current?.(token, queueRef.current.length);

    if (modeRef.current === "auto") drain();
  }, [cooldownMs, drain, refreshSize]);

  // En modo manual: procesar el siguiente token de la cola
  const processNext = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    const token = queueRef.current.shift();
    refreshSize();
    await runOne(token);
  }, [runOne, refreshSize]);

  const clear = useCallback(() => {
    queueRef.current = [];
    refreshSize();
  }, [refreshSize]);

  // Si el usuario cambia de manual → auto y hay cola pendiente, drenarla
  useEffect(() => {
    if (mode === "auto") drain();
  }, [mode, drain]);

  return {
    mode,
    setMode,
    queueSize,
    processing,
    enqueue,
    processNext,
    clear,
  };
}
