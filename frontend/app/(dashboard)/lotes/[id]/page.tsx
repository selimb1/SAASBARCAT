"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FileText, CheckCircle2, AlertTriangle, ArrowLeft,
  Search, Filter, Loader2, Download, CheckCircle, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { ExportarPanel } from "@/components/export/ExportarPanel";
import { ComprobanteEditor } from "@/components/review/ComprobanteEditor";

export default function DetalleLotePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [comprobantes, setComprobantes] = useState<any[]>([]);
  const [selectedComp, setSelectedComp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [filter, setFilter] = useState<"todos" | "pendiente" | "aprobado" | "error">("todos");

  const fetchData = async () => {
    try {
      const [statsRes, compsRes] = await Promise.all([
        api.get(`/lotes/${id}/stats`),
        api.get(`/lotes/${id}/comprobantes?limit=200`),
      ]);
      setStats(statsRes.data);
      setComprobantes(compsRes.data);
      // Seleccionar el primero pendiente por defecto, si existe
      if (!selectedComp && compsRes.data.length > 0) {
         const firstPending = compsRes.data.find((c: any) => c.estado_revision === "pendiente");
         setSelectedComp(firstPending || compsRes.data[0]);
      } else if (selectedComp) {
         // updated active comprobante
         const updated = compsRes.data.find((c: any) => c.id === selectedComp.id);
         if (updated) setSelectedComp(updated);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh stats if processing
    let interval: NodeJS.Timeout;
    if (stats && stats.procesados < stats.total) {
      interval = setInterval(fetchData, 3000);
    }
    return () => clearInterval(interval);
  }, [id, stats?.procesados, stats?.total]);

  const handleApproveAll = async () => {
    setApprovingAll(true);
    try {
      await api.post(`/lotes/${id}/aprobar-todos`);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setApprovingAll(false);
    }
  };

  const filteredComps = comprobantes.filter(c => {
    if (filter === "todos") return true;
    if (filter === "error") return c.estado_revision === "error_extraccion";
    return c.estado_revision === filter;
  });

  const getConfidenceColor = (conf: number | null) => {
    if (conf === null) return "text-dark-500 bg-dark-800";
    if (conf >= 0.85) return "text-success-500 bg-success-500/10 border-success-500/20";
    if (conf >= 0.70) return "text-warning-500 bg-warning-500/10 border-warning-500/20";
    return "text-danger-500 bg-danger-500/10 border-danger-500/20";
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const procesando = stats && stats.procesados < stats.total;

  return (
    <div className="h-full flex flex-col -mx-4 lg:-mx-8">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-dark-800 bg-dark-900/80 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard/lotes")} className="btn-ghost btn-sm p-2 rounded-lg">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-dark-50 flex items-center gap-3">
              Revisión de Lote
              {procesando && (
                <span className="badge badge-brand text-xs">Procesando {stats.procesados}/{stats.total}</span>
              )}
            </h1>
            <p className="text-sm text-dark-400">ID: {id?.slice(0, 8)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleApproveAll}
            disabled={approvingAll || procesando || stats?.aprobados === stats?.total}
            className="btn-secondary btn-sm"
          >
           {approvingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
           Aprobar pendientes
          </button>
          <button
            onClick={() => setExportModalOpen(!exportModalOpen)}
            disabled={procesando || comprobantes.length === 0}
            className={`btn-md ${exportModalOpen ? 'btn-secondary text-brand-400' : 'btn-primary'}`}
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      {exportModalOpen && (
        <div className="px-6 py-6 bg-dark-900/50 border-b border-dark-800 shrink-0 shadow-[inset_0_-10px_20px_-10px_rgba(0,0,0,0.5)]">
           <ExportarPanel loteId={id} totalComprobantes={stats?.aprobados} />
        </div>
      )}

      {/* Main Content Split */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: List */}
        <div className="w-1/3 min-w-[300px] max-w-[400px] border-r border-dark-800 bg-dark-950/50 flex flex-col overflow-hidden shrink-0">
          
          <div className="p-4 border-b border-dark-800 shrink-0 flex flex-col gap-3">
             <div className="flex gap-2 p-1 bg-dark-800/50 rounded-xl border border-dark-700/50">
               {(["todos", "pendiente", "aprobado", "error"] as const).map(f => (
                 <button
                   key={f}
                   onClick={() => setFilter(f)}
                   className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors capitalize ${filter === f ? 'bg-dark-700 text-dark-50 shadow-sm' : 'text-dark-400 hover:text-dark-200'}`}
                 >
                   {f}
                 </button>
               ))}
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 scroll-smooth">
            {filteredComps.map((c) => {
              const active = selectedComp?.id === c.id;
              const conf = c.confianza_global;
              
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedComp(c)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                    active ? 'bg-dark-800 border-dark-600 shadow-md transform scale-[1.01]' : 'border-transparent hover:bg-dark-800/40 hover:border-dark-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">
                      {c.tipo_comprobante || "Desc"}
                    </span>
                    <span className="flex items-center gap-1">
                      {c.estado_revision === "aprobado" && <CheckCircle2 className="w-3.5 h-3.5 text-success-500" />}
                      {c.estado_revision === "pendiente" && <Clock className="w-3.5 h-3.5 text-warning-500" />}
                      {c.estado_revision === "error_extraccion" && <AlertTriangle className="w-3.5 h-3.5 text-danger-500" />}
                      {conf !== null && (
                         <span className={`text-[10px] font-bold px-1.5 rounded border ${getConfidenceColor(conf)}`}>
                           {Math.round(conf * 100)}%
                         </span>
                      )}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-dark-100 truncate">
                     {c.razon_social_emisor || c.nombre_archivo_original || "Sin proveedor"}
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-dark-500">
                    <span className="truncate max-w-[60%]">{c.numero_comprobante ? `${c.punto_venta}-${c.numero_comprobante}` : "S/N"}</span>
                    <span className="font-mono text-dark-300">
                      ${c.importe_total?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </button>
              )
            })}
            
            {!loading && filteredComps.length === 0 && (
               <div className="p-8 text-center text-dark-500 text-sm">
                 No hay comprobantes
               </div>
            )}
          </div>
        </div>

        {/* Right Content: Editor */}
        <div className="flex-1 bg-dark-950 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {selectedComp ? (
              <motion.div
                key={selectedComp.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <ComprobanteEditor
                  comprobante={selectedComp}
                  onSaved={() => fetchData()}
                />
              </motion.div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-dark-500 p-8">
                  <FileText className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg font-medium">Seleccioná un comprobante</p>
                  <p className="text-sm mt-2">Revisá los datos o exportá el lote</p>
               </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
