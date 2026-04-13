"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, FileCheck2, Download,
  Users, Settings, LogOut, FileText, ChevronRight,
  Bell, Menu, X, HelpCircle
} from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/lotes", icon: Package, label: "Lotes" },
  { href: "/dashboard/comprobantes", icon: FileCheck2, label: "Comprobantes" },
  { href: "/dashboard/exportar", icon: Download, label: "Exportar" },
  { href: "/dashboard/clientes", icon: Users, label: "Clientes" },
];

const bottomItems = [
  { href: "/dashboard/configuracion", icon: Settings, label: "Configuración" },
  { href: "#", icon: HelpCircle, label: "Ayuda" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { usuario, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full py-4">
      {/* Logo */}
      <div className="px-4 mb-8">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-glow-brand flex-shrink-0">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white">contabiliz<span className="text-brand-400">AR</span></span>
          </div>
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        <p className="px-3 mb-2 text-xs font-semibold text-dark-600 uppercase tracking-wider">Principal</p>
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={active ? "sidebar-item-active" : "sidebar-item"}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="px-2 space-y-0.5 mb-4">
        {bottomItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={label}
            href={href}
            className="sidebar-item"
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </Link>
        ))}
        <button onClick={logout} className="sidebar-item w-full text-danger-400 hover:text-danger-300 hover:bg-danger-500/10">
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>

      {/* User info */}
      <div className="mx-2 p-3 rounded-xl bg-dark-800/60 border border-dark-700/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600/30 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-brand-400">
              {usuario?.nombre?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-dark-200 truncate">{usuario?.nombre}</p>
            <p className="text-xs text-dark-500 truncate">{usuario?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 min-h-screen bg-dark-900/80 backdrop-blur-xl border-r border-dark-800/80 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile: topbar toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-dark-900/90 backdrop-blur-xl border-b border-dark-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white">contabiliz<span className="text-brand-400">AR</span></span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="btn-ghost btn-sm"
          id="mobile-menu-toggle"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-40 w-56 bg-dark-900 border-r border-dark-800"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
