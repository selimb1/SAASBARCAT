import { create } from "zustand";
import { persist } from "zustand/middleware";
import Cookies from "js-cookie";

interface Usuario {
  id: string;
  estudio_id: string;
  nombre: string;
  email: string;
  rol: string;
}

interface AuthState {
  usuario: Usuario | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string, refreshToken: string, usuario: Usuario) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      isAuthenticated: false,

      setAuth: (accessToken, refreshToken, usuario) => {
        Cookies.set("access_token", accessToken, { expires: 1 / 96, secure: true, sameSite: "strict" });
        Cookies.set("refresh_token", refreshToken, { expires: 7, secure: true, sameSite: "strict" });
        set({ usuario, isAuthenticated: true });
      },

      logout: () => {
        Cookies.remove("access_token");
        Cookies.remove("refresh_token");
        set({ usuario: null, isAuthenticated: false });
        window.location.href = "/login";
      },
    }),
    {
      name: "contabilizar-auth",
      partialize: (state) => ({ usuario: state.usuario, isAuthenticated: state.isAuthenticated }),
    }
  )
);
