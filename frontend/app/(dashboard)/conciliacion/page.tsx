"use client";

import { Building2 } from "lucide-react";

export default function ConciliacionPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-400" />
            Conciliación Bancaria
          </h1>
          <p className="text-sm text-dark-300 mt-1">
            Módulo en desarrollo: Sincroniza y concilia los comprobantes procesados con los extractos bancarios.
          </p>
        </div>
      </div>

      <div className="card text-center py-20 flex flex-col items-center justify-center border-dashed border-2 border-dark-600 bg-dark-800/20">
        <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center mb-4 border border-brand-500/20">
          <Building2 className="w-8 h-8 text-brand-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Próximamente</h2>
        <p className="text-dark-300 max-w-md">
          Estamos construyendo la herramienta más rápida para conciliar tus lotes procesados por IA directamente con el banco.
        </p>
      </div>
    </div>
  );
}
