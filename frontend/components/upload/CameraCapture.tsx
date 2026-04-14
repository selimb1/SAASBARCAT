"use client";

/**
 * CameraCapture — Captura fotos de comprobantes desde el navegador.
 * Usa MediaDevices.getUserMedia() → funciona en iOS Safari 14.3+ y Chrome Android.
 * Incluye guía de encuadre, detección de luminosidad y compresión cliente-side.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, X, RotateCcw, Check, SunMedium, AlertCircle, ZoomIn, FlipHorizontal,
} from "lucide-react";

interface CapturedPhoto {
  id: string;
  blob: Blob;
  preview: string;
  file: File;
  brightness: number;
}

interface CameraCaptureProps {
  onPhotos: (files: File[]) => void;
  onClose: () => void;
  maxPhotos?: number;
}

export function CameraCapture({ onPhotos, onClose, maxPhotos = 50 }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<"preview" | "review">("preview");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [error, setError] = useState<string>("");
  const [brightness, setBrightness] = useState<number>(128);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [flash, setFlash] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const brightnessLabel =
    brightness < 60 ? "Muy oscuro — buscá mejor iluminación" :
    brightness < 100 ? "Algo oscuro — podés mejorar la luz" :
    brightness > 220 ? "Sobreexpuesto — alejate de la luz" :
    "Iluminación correcta ✓";

  const brightnessColor =
    brightness < 60 ? "text-danger-400" :
    brightness < 100 ? "text-warning-400" :
    brightness > 220 ? "text-warning-400" :
    "text-success-400";

  // ── Abrir cámara ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async (facingMode: "environment" | "user" = "environment") => {
    try {
      // Detener stream anterior si existe
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ torch: false }],
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
      setError("");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Permiso de cámara denegado. Habilitalo en la configuración del navegador.");
      } else if (err.name === "NotFoundError") {
        setError("No se encontró cámara en este dispositivo.");
      } else {
        setError(`Error al abrir la cámara: ${err.message}`);
      }
    }
  }, []);

  // ── Detectar luminosidad en tiempo real ──────────────────────────────────
  useEffect(() => {
    if (!cameraReady) return;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");

    const interval = setInterval(() => {
      if (!videoRef.current || !ctx) return;
      ctx.drawImage(videoRef.current, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      setBrightness(Math.round(sum / (64 * 64)));
    }, 800);

    return () => clearInterval(interval);
  }, [cameraReady]);

  // ── Cycle cámara frontal/trasera ─────────────────────────────────────────
  const flipCamera = useCallback(async () => {
    const newFacing = facing === "environment" ? "user" : "environment";
    setFacing(newFacing);
    setCameraReady(false);
    await startCamera(newFacing);
  }, [facing, startCamera]);

  // ── Tomar foto ───────────────────────────────────────────────────────────
  const takePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;
    if (photos.length >= maxPhotos) return;

    // Flash effect
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Comprimir a JPEG calidad 0.88 (buen balance tamaño/calidad para OCR)
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.88);
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `comprobante-${timestamp}.jpg`;
    const file = new File([blob], filename, { type: "image/jpeg" });
    const preview = URL.createObjectURL(blob);

    setPhotos((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), blob, preview, file, brightness },
    ]);
  }, [videoRef, canvasRef, cameraReady, photos.length, maxPhotos, brightness]);

  // ── Montar/desmontar ─────────────────────────────────────────────────────
  useEffect(() => {
    startCamera(facing);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  const confirmPhotos = () => {
    onPhotos(photos.map((p) => p.file));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      {/* Flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-50 bg-white pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-safe-top py-3 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); onClose(); }}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
          aria-label="Cerrar cámara"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-white text-sm font-semibold">
            {photos.length > 0 ? `${photos.length} foto${photos.length > 1 ? "s" : ""} capturada${photos.length > 1 ? "s" : ""}` : "Cámara"}
          </p>
          <p className={`text-xs ${brightnessColor}`}>{brightnessLabel}</p>
        </div>
        <button
          onClick={flipCamera}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
          aria-label="Cambiar cámara"
        >
          <FlipHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Viewfinder */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Guía de encuadre */}
        {cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Overlay oscurecido fuera del rectángulo */}
            <div className="absolute inset-0 bg-black/30" />
            {/* Rectángulo guía */}
            <div
              className="relative z-10 border-2 border-white/70 rounded-lg"
              style={{
                width: "85%",
                maxWidth: 480,
                aspectRatio: "1.414 / 1", // A4 ratio
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
              }}
            >
              {/* Esquinas */}
              {["tl", "tr", "bl", "br"].map((corner) => (
                <span
                  key={corner}
                  className={`absolute w-6 h-6 border-brand-400
                    ${corner === "tl" ? "top-0 left-0 border-t-2 border-l-2 rounded-tl" : ""}
                    ${corner === "tr" ? "top-0 right-0 border-t-2 border-r-2 rounded-tr" : ""}
                    ${corner === "bl" ? "bottom-0 left-0 border-b-2 border-l-2 rounded-bl" : ""}
                    ${corner === "br" ? "bottom-0 right-0 border-b-2 border-r-2 rounded-br" : ""}
                  `}
                />
              ))}
              <p className="absolute -bottom-7 left-0 right-0 text-center text-white/70 text-xs">
                Alineá el comprobante dentro del recuadro
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="bg-dark-900/90 backdrop-blur rounded-2xl p-6 flex flex-col items-center gap-3 max-w-xs w-full border border-danger-500/30">
              <AlertCircle className="w-10 h-10 text-danger-400" />
              <p className="text-white text-sm text-center">{error}</p>
              <button
                onClick={() => startCamera(facing)}
                className="btn-primary btn-sm w-full"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Previews de fotos capturadas (tira inferior izquierda) */}
        {photos.length > 0 && (
          <div className="absolute bottom-4 left-4 flex gap-2 z-20">
            {photos.slice(-3).map((p) => (
              <div key={p.id} className="relative">
                <img
                  src={p.preview}
                  alt="Foto capturada"
                  className="w-14 h-14 rounded-lg object-cover border-2 border-white/60"
                />
                <button
                  onClick={() => removePhoto(p.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger-500 flex items-center justify-center"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
            {photos.length > 3 && (
              <div className="w-14 h-14 rounded-lg bg-dark-800/80 border-2 border-white/30 flex items-center justify-center">
                <span className="text-white text-xs font-bold">+{photos.length - 3}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="pb-safe-bottom py-6 bg-gradient-to-t from-black to-transparent flex items-center justify-center gap-8">
        {/* Volver si hay fotos */}
        {photos.length > 0 ? (
          <button
            onClick={() => setPhotos([])}
            className="w-12 h-12 rounded-full bg-dark-800/70 backdrop-blur border border-white/20 flex items-center justify-center text-white"
            aria-label="Descartar todas"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-12 h-12" />
        )}

        {/* Botón de captura */}
        <button
          onClick={takePhoto}
          disabled={!cameraReady || photos.length >= maxPhotos}
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/10 backdrop-blur
            active:scale-95 transition-transform disabled:opacity-40"
          aria-label="Tomar foto"
        >
          <div className="w-14 h-14 rounded-full bg-white" />
        </button>

        {/* Confirmar */}
        {photos.length > 0 ? (
          <button
            onClick={confirmPhotos}
            className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center shadow-glow-brand border border-brand-400/30"
            aria-label={`Usar ${photos.length} foto${photos.length > 1 ? "s" : ""}`}
          >
            <Check className="w-5 h-5 text-white" />
          </button>
        ) : (
          <div className="w-12 h-12" />
        )}
      </div>

      {/* Tip cuando hay fotos */}
      {photos.length > 0 && (
        <div className="absolute bottom-28 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-xs text-white/60 bg-black/40 rounded-full px-3 py-1">
            Presioná ✓ para usar las fotos o seguí sacando más
          </span>
        </div>
      )}
    </motion.div>
  );
}
