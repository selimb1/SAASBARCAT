"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, X, FileText, CheckCircle2,
  AlertCircle, Loader2, ArrowRight, FolderOpen, Camera
} from "lucide-react";
import { api, apiUpload } from "@/lib/api";
import { useRouter } from "next/navigation";
import { CameraCapture } from "@/components/upload/CameraCapture";

interface FilePreview {
  file: File;
  id: string;
  preview?: string;
  status: "pending" | "uploading" | "done" | "error";
}

export default function NuevoLotePage() {
  const router = useRouter();
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [nombre, setNombre] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);

  // Recibe fotos capturadas por CameraCapture y las agrega a la cola
  const handleCameraPhotos = useCallback((capturedFiles: File[]) => {
    const newPreviews: FilePreview[] = capturedFiles.map((f) => ({
      file: f,
      id: Math.random().toString(36).slice(2),
      preview: URL.createObjectURL(f),
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...newPreviews].slice(0, 200));
  }, []);

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles: FilePreview[] = accepted.map((f) => ({
      file: f,
      id: Math.random().toString(36).slice(2),
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...newFiles].slice(0, 200));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 200,
    maxSize: 20 * 1024 * 1024,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubir = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    setProgress(0);

    try {
      // 1. Crear lote
      const loteRes = await api.post("/lotes", { nombre: nombre || undefined });
      const loteId = loteRes.data.id;

      // 2. Subir archivos
      const formData = new FormData();
      files.forEach((fp) => formData.append("archivos", fp.file));

      await apiUpload(`/lotes/${loteId}/upload`, formData, (pct) => setProgress(pct));

      // 3. Ir al lote procesando
      router.push(`/dashboard/lotes/${loteId}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Error al subir los archivos");
    } finally {
      setUploading(false);
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);
  const sizeLabel = totalSize > 1024 * 1024
    ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(totalSize / 1024)} KB`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Camera modal */}
      <AnimatePresence>
        {cameraOpen && (
          <CameraCapture
            onPhotos={handleCameraPhotos}
            onClose={() => setCameraOpen(false)}
            maxPhotos={50}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-50">Nuevo Lote</h1>
        <p className="text-dark-500 text-sm mt-1">
          Subí fotos o PDFs de comprobantes para procesarlos con IA
        </p>
      </div>

      {/* Nombre del lote */}
      <div className="card p-5 space-y-4">
        <h3 className="text-dark-200">Información del lote</h3>
        <div>
          <label className="label">Nombre (opcional)</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Compras Abril 2026 — Cliente XYZ"
            className="input"
            id="lote-nombre"
          />
        </div>
      </div>

      {/* Captura con cámara — prominente en mobile */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5 text-brand-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-dark-200">Capturar con cámara</p>
            <p className="text-xs text-dark-500 mt-0.5">
              Ideal para celular — guía de encuadre, detección de luz y compresión automática
            </p>
          </div>
          <button
            onClick={() => setCameraOpen(true)}
            id="abrir-camara-btn"
            className="btn-primary btn-sm shrink-0"
          >
            <Camera className="w-4 h-4" />
            Abrir cámara
          </button>
        </div>

        {/* Separador "o" */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-dark-800" />
          <span className="text-xs text-dark-600 font-medium">o subí archivos</span>
          <div className="flex-1 h-px bg-dark-800" />
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`dropzone min-h-36 ${isDragActive ? "dropzone-active" : ""}`}
          id="dropzone-area"
        >
          <input {...getInputProps()} id="file-input" />
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
            isDragActive ? "bg-brand-500/30 shadow-glow-brand" : "bg-dark-800 border border-dark-700"
          }`}>
            {isDragActive
              ? <FolderOpen className="w-6 h-6 text-brand-400" />
              : <Upload className="w-6 h-6 text-dark-400" />
            }
          </div>
          <div className="text-center">
            <p className="text-dark-200 font-medium text-sm">
              {isDragActive ? "Soltá los archivos acá" : "Arrastrá o seleccioná archivos"}
            </p>
            <p className="text-dark-500 text-xs mt-1">
              JPG · PNG · PDF · WEBP · hasta 200 archivos · máx 20 MB c/u
            </p>
          </div>
        </div>
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="card overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-dark-800/60">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success-500" />
                <span className="text-sm font-semibold text-dark-200">
                  {files.length} archivo{files.length !== 1 ? "s" : ""} seleccionado{files.length !== 1 ? "s" : ""}
                </span>
                <span className="text-dark-500 text-xs">({sizeLabel})</span>
              </div>
              <button
                onClick={() => setFiles([])}
                className="btn-ghost btn-sm text-danger-400 hover:text-danger-300"
              >
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            </div>

            {/* Grid de previews */}
            <div className="p-4 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-60 overflow-y-auto">
              {files.map((fp) => (
                <motion.div
                  key={fp.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group aspect-square rounded-lg overflow-hidden bg-dark-800 border border-dark-700"
                >
                  {fp.preview ? (
                    <img src={fp.preview} alt={fp.file.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="w-5 h-5 text-dark-500" />
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(fp.id)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-dark-900/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-500/10 border border-danger-500/20">
          <AlertCircle className="w-4 h-4 text-danger-400 flex-shrink-0" />
          <p className="text-danger-400 text-sm">{error}</p>
        </div>
      )}

      {/* Progress */}
      {uploading && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-dark-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
              Subiendo archivos...
            </span>
            <span className="text-brand-400 font-semibold">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-dark-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="btn-secondary btn-md"
          disabled={uploading}
        >
          Cancelar
        </button>
        <button
          onClick={handleSubir}
          disabled={files.length === 0 || uploading}
          className="btn-primary btn-md"
          id="procesar-btn"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          {uploading ? "Procesando..." : `Procesar ${files.length > 0 ? files.length + " archivos" : ""}`}
        </button>
      </div>
    </div>
  );
}
