"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { FileText, Eye, EyeOff, ArrowRight, CheckCircle2, Zap, Shield } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", data);
      setAuth(res.data.access_token, res.data.refresh_token, res.data.usuario);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Zap, text: "Extracción IA en segundos" },
    { icon: CheckCircle2, text: "Validación AFIP automática" },
    { icon: Shield, text: "Datos seguros — Ley 25.326" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-dark-950 to-dark-950" />
        <div className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(at 30% 40%, rgba(99,102,241,0.3) 0px, transparent 50%), radial-gradient(at 70% 70%, rgba(168,85,247,0.2) 0px, transparent 50%)"
          }}
        />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)",
            backgroundSize: "48px 48px"
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-glow-brand">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">contabiliz<span className="text-brand-400">AR</span></span>
          </div>

          {/* Central content */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl font-bold text-white leading-tight mb-4">
                De la foto<br />al asiento,<br />
                <span className="text-gradient">sin tocar<br />el teclado.</span>
              </h1>
              <p className="text-dark-300 text-lg mb-8 max-w-sm">
                Subí fotos o PDFs de comprobantes y exportalos listos para Holistor, Tango Gestión y Bejerman.
              </p>
              <div className="space-y-3">
                {features.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-dark-200">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-brand-400" />
                    </div>
                    <span className="text-sm font-medium">{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Footer */}
          <p className="text-dark-500 text-sm">
            © 2026 contabilizAR · Hecho para contadores argentinos
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-dark-950">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">contabiliz<span className="text-brand-400">AR</span></span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1">Iniciá sesión</h2>
            <p className="text-dark-400 text-sm">Ingresá a tu estudio contable</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                {...register("email")}
                type="email"
                placeholder="contador@estudio.com.ar"
                className="input"
                id="email"
                autoComplete="email"
              />
              {errors.email && <p className="text-danger-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  className="input pr-10"
                  id="password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300 transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-danger-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="rounded-xl bg-danger-500/10 border border-danger-500/20 p-3">
                <p className="text-danger-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary btn-lg w-full"
              id="login-submit"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-dark-400 text-sm mt-6">
            ¿No tenés cuenta?{" "}
            <Link href="/registro" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Probá 30 días gratis
            </Link>
          </p>

          {/* Legal */}
          <p className="text-center text-dark-600 text-xs mt-8">
            Al ingresar aceptás nuestros{" "}
            <a href="#" className="underline hover:text-dark-400">Términos de Uso</a>
            {" "}y{" "}
            <a href="#" className="underline hover:text-dark-400">Política de Privacidad</a>
            {" "}(Ley 25.326)
          </p>
        </motion.div>
      </div>
    </div>
  );
}
