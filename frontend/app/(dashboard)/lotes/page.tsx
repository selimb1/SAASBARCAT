"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  FileText, Plus, ChevronRight, Search, FileDown,
  Clock, AlertTriangle, CheckCircle2, Loader2, ArrowRight
} from "lucide-react";
import { api } from "@/lib/api";
import { motion } from "framer-motion";

function LoteBadge({ estado }: { estado: string }) {
  const configs: Record<string, { cls: string, text: string, icon: any }> = {
    completado: { cls: "badge-success", text: "Completado", icon: CheckCircle2 },
    completado_con_errores: { cls: "badge-warning", text: "Con alertas", icon: AlertTriangle },
    procesando: { cls: "badge-brand animate-pulse", text: "Procesando IA", icon: Loader2 },
    pendiente: { cls: "badge-neutral", text: "Pendiente", icon: Clock },
    error: { cls: "badge-danger", text: "Error", icon: AlertTriangle },
  };

  const c = configs[estado] || { cls: "badge-neutral", text: estado, icon: Clock };
  const Icon = c.icon;

  return (
    <span className={`badge ${c.cls} flex items-center gap-1.5`}>
      <Icon className={`w-3 h-3 ${estado === 'procesando' ? 'animate-spin' : ''}`} />
      {c.text}
    </span>
  );
}

export default function LotesPage() {
  const [lotes, setLotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchLotes = async () => {
    try {
      const res = await api.get("/lotes?limit=100");
      setLotes(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLotes();
    
    // Auto refresh every 5 seconds if there is any lote processing
    const isProcessing = lotes.some((l) => l.estado === "procesando" || l.estado === "pendiente");
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      interval = setInterval(fetchLotes, 5000);
    }
    return () => clearInterval(interval);
  }, [lotes]);

  const filteredLotes = lotes.filter((l) => 
    l.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-50">Lotes de Comprobantes</h1>
          <p className="text-dark-500 text-sm mt-1">
            Revisá y exportá los comprobantes procesados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/lotes/nuevo" id="nuevo-lote-btn">
            <button className="btn-primary btn-md">
              <Plus className="w-4 h-4" />
              Nuevo Lote
            </button>
          </Link>
        </div>
      </div>

      {/* Tool bar */}
      <div className="card p-4 flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {loading && lotes.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-dark-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-500" />
            <p>Cargando lotes...</p>
          </div>
        ) : filteredLotes.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-dark-700 mx-auto mb-4" />
            <h3 className="text-dark-200 font-medium text-lg">No hay lotes todavía</h3>
            <p className="text-dark-500 mt-1 max-w-sm mx-auto">
              Subí fotos o PDFs y nuestra IA extraerá los datos automáticamente para Tango, Holistor o Bejerman.
            </p>
            <Link href="/dashboard/lotes/nuevo">
              <button className="btn-primary btn-sm mt-6">
                <Plus className="w-4 h-4" /> Crear primer lote
              </button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-900 border-b border-dark-800/80">
                  <th className="table-header w-2/5">Lote</th>
                  <th className="table-header">Estado</th>
                  <th className="table-header">Progreso</th>
                  <th className="table-header hidden sm:table-cell">Comprobantes</th>
                  <th className="table-header text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800/40">
                {filteredLotes.map((lote) => {
                  const pct = lote.total_archivos ? Math.round((lote.procesados / lote.total_archivos) * 100) : 0;
                  
                  return (
                    <motion.tr 
                      key={lote.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="table-row group"
                    >
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors
                            ${lote.estado === 'completado' ? 'bg-success-500/10 border border-success-500/20' : 
                              lote.estado === 'procesando' ? 'bg-brand-500/10 border border-brand-500/20' : 
                              'bg-dark-800 border border-dark-700'}`}
                          >
                            <FileText className={`w-5 h-5 
                              ${lote.estado === 'completado' ? 'text-success-400' : 
                                lote.estado === 'procesando' ? 'text-brand-400' : 
                                'text-dark-500'}`} 
                            />
                          </div>
                          <div>
                            <Link href={`/dashboard/lotes/${lote.id}`} className="text-sm font-semibold text-dark-100 hover:text-brand-400 transition-colors">
                              {lote.nombre || `Lote sin nombre`}
                            </Link>
                            <p className="text-xs text-dark-500 font-mono mt-0.5">
                              ID: {lote.id.slice(0, 8)} • {format(new Date(lote.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <LoteBadge estado={lote.estado} />
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-3 max-w-[150px]">
                          <div className="flex-1 h-2 rounded-full bg-dark-800 overflow-hidden">
                            <motion.div 
                              className={`h-full rounded-full transition-all duration-500
                                ${lote.errores > 0 ? 'bg-warning-500' : 'bg-brand-500'}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-dark-400 font-mono w-8 text-right">{pct}%</span>
                        </div>
                        {lote.errores > 0 && (
                          <p className="text-[10px] text-warning-400 mt-1">{lote.errores} errores al extraer</p>
                        )}
                      </td>
                      <td className="table-cell hidden sm:table-cell text-center">
                         <span className="text-dark-200 font-semibold">{lote.total_archivos || 0}</span>
                      </td>
                      <td className="table-cell text-right">
                        <Link href={`/dashboard/lotes/${lote.id}`}>
                           <button className="btn-secondary btn-sm opacity-0 group-hover:opacity-100 transition-opacity">
                             Revisar <ArrowRight className="w-3.5 h-3.5" />
                           </button>
                        </Link>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
