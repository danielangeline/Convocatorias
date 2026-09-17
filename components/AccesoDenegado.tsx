import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/** Pantalla del 403 (RNF-30). No nombra rutas ni roles de otros portales. */
export function AccesoDenegado() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-50/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-danger">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-ink">No tienes acceso a esta sección</h1>
        <p className="mt-2 text-sm text-ink-soft">Esta parte de la plataforma no está disponible para tu tipo de cuenta.</p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-900"
        >
          Ir a mi inicio
        </Link>
      </div>
    </div>
  );
}
