import { ConsultorNavbar } from "@/components/ConsultorNavbar";
import { ModalSuscripcion } from "@/components/ModalSuscripcion";
import { ModalCreditos } from "@/components/ModalCreditos";
import { SincronizarSesion } from "@/components/SincronizarSesion";
import { exigirRol } from "@/lib/auth";

// Portal Consultor: solo rol consultor (RNF-30). proxy.ts ya lo aplica; esta
// es la segunda barrera.
export default async function ConsultorLayout({ children }: { children: React.ReactNode }) {
  const datos = await exigirRol(["consultor"], { ruta: "portal consultor" });

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SincronizarSesion datos={datos} />
      <ConsultorNavbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <footer className="border-t border-line-soft py-6 text-center text-xs text-ink-faint">
        Plataforma de Gestión de Convocatorias — portal de consultores; la cuenta es real, el resto, datos de ejemplo.
      </footer>
      <ModalSuscripcion />
      <ModalCreditos />
    </div>
  );
}
