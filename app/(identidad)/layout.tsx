import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

// Identidad (login, registro, MFA, recuperar, definir contraseña): una tarjeta
// centrada sobre el fondo de la app, con la marca y el cambio de tema.
export default function IdentidadLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" aria-label="Inicio de Convocatorias">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:pt-10">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">{children}</div>
      </main>
    </div>
  );
}
