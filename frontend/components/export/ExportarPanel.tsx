"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, CheckCircle2, ChevronDown, Loader2,
  FileSpreadsheet, FileText as FileTxt, Table2, Info,
  Zap, ArrowRight
} from "lucide-react";
import { api } from "@/lib/api";
import { useSearchParams } from "next/navigation";

const SISTEMAS = [
  {
    id: "tango",
    nombre: "Tango Gestión",
    logo: "🟦",
    desc: "Módulo Comprobantes a Pagar / Compras",
    formato: "TXT delimitado por |",
    ext: ".txt",
    icon: FileTxt,
    color: "from-blue-600/20 to-blue-700/10 border-blue-500/30",
    iconColor: "text-blue-400",
  },
  {
    id: "holistor",
    nombre: "Holistor",
    logo: "🟩",
    desc: "Módulo Compras + Asientos contables",
    formato: "Excel (.xlsx) con hojas separadas",
    ext: ".xlsx",
    icon: FileSpreadsheet,
    color: "from-green-600/20 to-green-700/10 border-green-500/30",
    iconColor: "text-green-400",
  },
  {
    id: "bejerman",
    nombre: "Bejerman",
    logo: "🟧",
    desc: "Módulo Comprobantes de Compra",
    formato: "CSV separado por ; (UTF-8)",
    ext: ".csv",
    icon: Table2,
    color: "from-orange-600/20 to-orange-700/10 border-orange-500/30",
    iconColor: "text-orange-400",
  },
  {
    id: "bejerman_asientos",
    nombre: "Bejerman — Asientos",
    logo: "🟧",
    desc: "Módulo de Asientos Contables",
    formato: "CSV separado por ; (UTF-8)",
    ext: ".csv",
    icon: Table2,
    color: "from-orange-600/20 to-orange-700/10 border-orange-500/30",
    iconColor: "text-orange-400",
  },
  {
    id: "csv_generico",
    nombre: "CSV Genérico",
    logo: "⬜",
    desc: "Todos los campos, formato configurable",
    formato: "CSV separado por ; (UTF-8)",
    ext: ".csv",
    icon: Table2,
    color: "from-dark-700/40 to-dark-800/20 border-dark-600/40",
    iconColor: "text-dark-400",
  },
];

const ESTADOS_OPCIONES = [
  { id: "aprobado", label: "✅ Aprobados" },
  { id: "pendiente", label: "⏳ Pendientes" },
];

interface ExportarPanelProps {
  loteId: string;
  totalComprobantes?: number;
}

export function ExportarPanel({ loteId, totalComprobantes = 0 }: ExportarPanelProps) {
  const [selectedSistema, setSelectedSistema] = useState<string | null>(null);
  const [estados, setEstados] = useState(["aprobado", "pendiente"]);
  const [cuentaGasto, setCuentaGasto] = useState("");
  const [empresaCodigo, setEmpresaCodigo] = useState("001");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const toggleEstado = (id: string) => {
    setEstados((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleExportar = async () => {
    if (!selectedSistema) return;
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await api.post(
        `/lotes/${loteId}/exportar`,
        {
          software: selectedSistema,
          incluir_estados: estados,
          cuenta_gasto_defecto: cuentaGasto || undefined,
          empresa_codigo: empresaCodigo || "001",
        },
        { responseType: "blob" }
      );

      // Trigger download
      const sistema = SISTEMAS.find((s) => s.id === selectedSistema);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `contabilizAR_${sistema?.nombre.replace(/\s/g, "_")}_${loteId.slice(-6)}.${sistema?.ext.replace(".", "")}`;
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccess(true);
    } catch (e: any) {
      setError("Error al generar el archivo. Verificá que haya comprobantes aprobados.");
    } finally {
      setLoading(false);
    }
  };

  const sistema = SISTEMAS.find((s) => s.id === selectedSistema);

  return (
    <div className="space-y-6">
      {/* Sistema selector */}
      <div>
        <h3 className="text-dark-300 text-sm font-semibold mb-3">1. Elegí el sistema contable</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SISTEMAS.map((s) => {
            const Icon = s.icon;
            const selected = selectedSistema === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSistema(s.id)}
                className={`relative p-4 rounded-xl border bg-gradient-to-br text-left transition-all duration-200 ${s.color}
                  ${selected ? "ring-2 ring-brand-500/60 border-brand-500/40 shadow-glow-brand" : "hover:border-dark-600"}`}
                id={`sistema-${s.id}`}
              >
                {selected && (
                  <CheckCircle2 className="absolute top-3 right-3 w-4 h-4 text-brand-400" />
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{s.logo}</span>
                  <span className="font-semibold text-dark-100 text-sm">{s.nombre}</span>
                </div>
                <p className="text-dark-400 text-xs">{s.desc}</p>
                <p className="text-dark-600 text-xs mt-1">{s.formato}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Opciones */}
      <AnimatePresence>
        {selectedSistema && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <div>
              <h3 className="text-dark-300 text-sm font-semibold mb-3">2. Opciones de exportación</h3>
              <div className="card p-4 space-y-4">
                {/* Estados */}
                <div>
                  <label className="label">Incluir comprobantes</label>
                  <div className="flex gap-3 flex-wrap">
                    {ESTADOS_OPCIONES.map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => toggleEstado(id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          estados.includes(id)
                            ? "bg-brand-500/20 border-brand-500/40 text-brand-300"
                            : "bg-dark-800 border-dark-700 text-dark-500 hover:border-dark-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Holistor / Bejerman specific */}
                {["holistor", "bejerman", "bejerman_asientos"].includes(selectedSistema) && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Código de empresa</label>
                      <input
                        type="text"
                        value={empresaCodigo}
                        onChange={(e) => setEmpresaCodigo(e.target.value)}
                        placeholder="001"
                        className="input"
                        id="empresa-codigo"
                      />
                    </div>
                    <div>
                      <label className="label">
                        Cuenta gasto por defecto
                        <span className="text-dark-600 font-normal ml-1">
                          {selectedSistema === "bejerman_asientos" ? "(8 dígitos)" : "(ej: 5.1.01.001)"}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={cuentaGasto}
                        onChange={(e) => setCuentaGasto(e.target.value)}
                        placeholder={selectedSistema === "bejerman_asientos" ? "51010100" : "5.1.01.001"}
                        className="input"
                        id="cuenta-gasto"
                      />
                    </div>
                  </div>
                )}

                {/* Preview info */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-brand-500/5 border border-brand-500/15">
                  <Info className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-dark-400 space-y-0.5">
                    <p><span className="text-dark-200 font-medium">Software:</span> {sistema?.nombre}</p>
                    <p><span className="text-dark-200 font-medium">Formato:</span> {sistema?.formato}</p>
                    <p><span className="text-dark-200 font-medium">Estados:</span> {estados.join(", ") || "ninguno"}</p>
                    <p><span className="text-dark-200 font-medium">Estimado:</span> ~{totalComprobantes} registros</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-500/10 border border-danger-500/20">
                <p className="text-danger-400 text-sm">{error}</p>
              </div>
            )}

            {/* Success */}
            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-success-500/10 border border-success-500/20"
              >
                <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0" />
                <p className="text-success-400 text-sm font-medium">
                  ¡Archivo generado! La descarga debería comenzar automáticamente.
                </p>
              </motion.div>
            )}

            {/* Download button */}
            <button
              onClick={handleExportar}
              disabled={loading || estados.length === 0}
              className="btn-primary btn-lg w-full"
              id="descargar-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando archivo...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Descargar {sistema?.ext} para {sistema?.nombre}
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
