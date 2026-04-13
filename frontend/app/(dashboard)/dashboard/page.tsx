"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText, ArrowUpRight, CheckCircle2, AlertTriangle,
  Clock, Zap, Plus, ChevronRight, TrendingUp, Target
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

const CHART_DATA = [
  { day: "Lun", comprobantes: 45 },
  { day: "Mar", comprobantes: 78 },
  { day: "Mié", comprobantes: 52 },
  { day: "Jue", comprobantes: 130 },
  { day: "Vie", comprobantes: 89 },
  { day: "Sáb", comprobantes: 23 },
  { day: "Hoy", comprobantes: 127 },
];

function StatCard({
  title, value, sub, icon: Icon, color = "brand", trend
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: any;
  color?: "brand" | "success" | "warning" | "danger";
  trend?: number;
}) {
  const colors = {
    brand: { bg: "bg-brand-500/15", border: "border-brand-500/20", icon: "text-brand-400" },
    success: { bg: "bg-success-500/15", border: "border-success-500/20", icon: "text-success-500" },
    warning: { bg: "bg-warning-500/15", border: "border-warning-500/20", icon: "text-warning-500" },
    danger: { bg: "bg-danger-500/15", border: "border-danger-500/20", icon: "text-danger-500" },
  }[color];

  return (
    <div className="stat-card card-hover">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${colors.icon}`} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${trend >= 0 ? "text-success-500" : "text-danger-500"}`}>
            <TrendingUp className={`w-3 h-3 ${trend < 0 ? "rotate-180" : ""}`} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-3xl font-bold text-dark-50">{value}</p>
        <p className="text-sm font-medium text-dark-400 mt-0.5">{title}</p>
        {sub && <p className="text-xs text-dark-600 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function LoteBadge({ estado }: { estado: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    completado: { cls: "badge-success", label: "✅ Listo" },
    completado_con_errores: { cls: "badge-warning", label: "⚠️ Con errores" },
    procesando: { cls: "badge-brand", label: "⚡ Procesando" },
    pendiente: { cls: "badge-neutral", label: "⏳ Pendiente" },
    error: { cls: "badge-danger", label: "❌ Error" },
  };
  const { cls, label } = cfg[estado] || { cls: "badge-neutral", label: estado };
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function DashboardPage() {
  const { usuario } = useAuthStore();
  const [stats, setStats] = useState({
    comprobantes_hoy: 0,
    comprobantes_mes: 0,
    lotes_activos: 0,
    precision_promedio: 98.4,
    tiempo_promedio_seg: 2.3,
    limite_mes: 300,
    usados_mes: 0,
  });
  const [lotes, setLotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [statsRes, lotesRes] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/lotes?limit=5"),
        ]);
        setStats(statsRes.data);
        setLotes(lotesRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const usadoPct = Math.min((stats.usados_mes / stats.limite_mes) * 100, 100);
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-50">
            {saludo}, <span className="text-gradient">{usuario?.nombre?.split(" ")[0]}</span>
          </h1>
          <p className="text-dark-500 text-sm mt-0.5">
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Link href="/dashboard/lotes/nuevo" id="nuevo-lote-btn">
          <button className="btn-primary btn-md">
            <Plus className="w-4 h-4" />
            Nuevo Lote
          </button>
        </Link>
      </div>

      {/* Stats grid */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          title="Comprobantes hoy"
          value={stats.comprobantes_hoy}
          icon={FileText}
          color="brand"
          trend={12}
        />
        <StatCard
          title="Precisión promedio"
          value={`${stats.precision_promedio}%`}
          icon={Target}
          color="success"
          trend={0.8}
        />
        <StatCard
          title="Tiempo promedio"
          value={`${stats.tiempo_promedio_seg}s`}
          sub="por comprobante"
          icon={Zap}
          color="warning"
        />
        <StatCard
          title="Lotes activos"
          value={stats.lotes_activos}
          icon={Clock}
          color={stats.lotes_activos > 0 ? "brand" : "danger"}
        />
      </motion.div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-2 card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-dark-100">Comprobantes esta semana</h3>
              <p className="text-dark-500 text-xs mt-0.5">Procesados por día</p>
            </div>
            <span className="badge-success badge">
              <TrendingUp className="w-3 h-3" /> +23% vs semana anterior
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={CHART_DATA}>
              <defs>
                <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#1E293B", border: "1px solid #334155",
                  borderRadius: "12px", fontSize: "12px", color: "#F1F5F9"
                }}
              />
              <Area
                type="monotone" dataKey="comprobantes" stroke="#6366F1"
                strokeWidth={2} fill="url(#brandGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Plan usage */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="card p-5 flex flex-col"
        >
          <h3 className="text-dark-100 mb-1">Uso del plan</h3>
          <p className="text-dark-500 text-xs mb-4">
            Abril 2026 — Plan <span className="text-brand-400 font-semibold capitalize">{usuario?.rol || "Starter"}</span>
          </p>

          <div className="flex-1 flex flex-col justify-center">
            {/* Circle progress */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="56" cy="56" r="46" fill="none" stroke="#1E293B" strokeWidth="8" />
                  <circle
                    cx="56" cy="56" r="46" fill="none"
                    stroke={usadoPct > 85 ? "#F43F5E" : usadoPct > 60 ? "#F59E0B" : "#6366F1"}
                    strokeWidth="8"
                    strokeDasharray={`${(usadoPct / 100) * 289} 289`}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-dark-50">{Math.round(usadoPct)}%</span>
                  <span className="text-xs text-dark-500">usado</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-dark-200 font-semibold">
                  {stats.usados_mes.toLocaleString("es-AR")} / {stats.limite_mes.toLocaleString("es-AR")}
                </p>
                <p className="text-dark-500 text-xs">comprobantes este mes</p>
              </div>
            </div>
          </div>

          <button className="btn-secondary btn-sm w-full mt-4" id="upgrade-plan-btn">
            <ArrowUpRight className="w-3 h-3" /> Mejorar plan
          </button>
        </motion.div>
      </div>

      {/* Recent lotes */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="card"
      >
        <div className="flex items-center justify-between p-5 border-b border-dark-800/60">
          <h3 className="text-dark-100">Lotes recientes</h3>
          <Link href="/dashboard/lotes" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
            Ver todos <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="divide-y divide-dark-800/40">
          {loading && (
            <div className="p-8 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            </div>
          )}
          {!loading && lotes.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400 font-medium">No hay lotes todavía</p>
              <p className="text-dark-600 text-sm mt-1">Creá tu primer lote para empezar</p>
              <Link href="/dashboard/lotes/nuevo">
                <button className="btn-primary btn-sm mt-4" id="primer-lote-btn">
                  <Plus className="w-3 h-3" /> Crear primer lote
                </button>
              </Link>
            </div>
          )}
          {lotes.map((lote) => (
            <Link
              key={lote.id}
              href={`/dashboard/lotes/${lote.id}`}
              className="flex items-center justify-between p-4 hover:bg-dark-800/30 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-dark-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-200 group-hover:text-dark-50 transition-colors">
                    {lote.nombre || `Lote #${lote.id.slice(-6).toUpperCase()}`}
                  </p>
                  <p className="text-xs text-dark-500">
                    {lote.total_archivos} comprobantes · {new Date(lote.created_at).toLocaleDateString("es-AR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <LoteBadge estado={lote.estado} />
                <ChevronRight className="w-4 h-4 text-dark-600 group-hover:text-dark-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
