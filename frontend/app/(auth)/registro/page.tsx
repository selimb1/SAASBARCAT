"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { FileText, Eye, EyeOff, ArrowRight, Building, User, Mail, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth";

const registerSchema = z.object({
  nombre_estudio: z.string().min(2, "Mínimo 2 caracteres"),
  nombre_usuario: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/register", data);
      setAuth(res.data.access_token, res.data.refresh_token, res.data.usuario);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — graphic */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-dark-950">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
         <div className="absolute inset-0 bg-gradient-to-tr from-brand-900/40 via-dark-950 to-dark-950 flex flex-col justify-center px-16">
            <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center shadow-glow-brand mb-8">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
               El futuro de tu<br/>estudio contable<br/>
               <span className="text-brand-400">empieza hoy.</span>
            </h1>
            <div className="space-y-4 border-l-2 border-brand-500/30 pl-6 text-dark-300">
               <p>"Ahorramos más de 15 horas semanales de tipeo en época de IVAs. La integración con Holistor es perfecta."</p>
               <p className="text-sm font-semibold text-white">— Estudio Lemos & Asoc.</p>
            </div>
         </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-dark-900 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
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
            <h2 className="text-2xl font-bold text-white mb-1">Crear Estudio</h2>
            <p className="text-dark-400 text-sm">30 días de prueba gratuita. Sin tarjeta de crédito.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Nombre del Estudio Contable</label>
              <div className="relative">
                <input
                  {...register("nombre_estudio")}
                  type="text"
                  placeholder="Estudio Pérez & Asoc."
                  className="input pl-10"
                />
                <Building className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              </div>
              {errors.nombre_estudio && <p className="text-danger-500 text-xs mt-1">{errors.nombre_estudio.message}</p>}
            </div>

            <div>
              <label className="label">Tu Nombre</label>
              <div className="relative">
                <input
                  {...register("nombre_usuario")}
                  type="text"
                  placeholder="Juan Pérez"
                  className="input pl-10"
                />
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              </div>
              {errors.nombre_usuario && <p className="text-danger-500 text-xs mt-1">{errors.nombre_usuario.message}</p>}
            </div>

            <div>
              <label className="label">Email Profesional</label>
              <div className="relative">
                <input
                  {...register("email")}
                  type="email"
                  placeholder="juan@estudioperez.com.ar"
                  className="input pl-10"
                />
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              </div>
              {errors.email && <p className="text-danger-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPwd ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  className="input pl-10 pr-10"
                />
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
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
              className="btn-primary btn-lg w-full mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Comenzar prueba gratis
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-dark-400 text-sm mt-6">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Iniciá sesión
            </Link>
          </p>

          <p className="text-center text-dark-600 text-xs mt-8">
            Al registrarte aceptás nuestros{" "}
            <a href="#" className="underline hover:text-dark-400">Términos de Uso</a>
            {" "}y{" "}
            <a href="#" className="underline hover:text-dark-400">Política de Privacidad</a>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
