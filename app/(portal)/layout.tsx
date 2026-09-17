import { Navbar } from "@/components/Navbar";
import { ModalSuscripcion } from "@/components/ModalSuscripcion";
import { ModalCreditos } from "@/components/ModalCreditos";
import { SincronizarSesion } from "@/components/SincronizarSesion";
import { exigirRol } from "@/lib/auth";

// Portal Empresa: solo rol empresa (RNF-30, docs/04 §8.2). proxy.ts ya lo
// aplica; esta es la segunda barrera.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const datos = await exigirRol(["empresa"], { ruta: "portal empresa" });

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SincronizarSesion datos={datos} />
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="border-t border-line-soft py-6 text-center text-xs text-ink-faint">
        Plataforma de Gestión de Convocatorias — la cuenta y la suscripción son reales; el resto, datos de ejemplo.
      </footer>
      <ModalSuscripcion />
      <ModalCreditos />
    </div>
  );
}
