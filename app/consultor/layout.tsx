import { AppShell } from "@/components/shell/AppShell";
import { ModalSuscripcion } from "@/components/ModalSuscripcion";
import { ModalCreditos } from "@/components/ModalCreditos";
import { SincronizarSesion } from "@/components/SincronizarSesion";
import { SincronizarPlanes } from "@/components/SincronizarPlanes";
import { Suspense } from "react";
import { AvisoPuerta } from "@/components/identidad/AvisoPuerta";
import { exigirRol } from "@/lib/auth";
import { contarSolicitudesConsultor } from "@/lib/shell-contadores";
import { leerTarifas, listarPlanesDelRol } from "@/lib/suscripcion-servidor";

// Portal Consultor: solo rol consultor (RNF-30). proxy.ts ya lo aplica; esta
// es la segunda barrera.
export default async function ConsultorLayout({ children }: { children: React.ReactNode }) {
  const datos = await exigirRol(["consultor"], { ruta: "portal consultor" });
  // Sprint 5: los planes activos de consultor (RF-82, docs/05 §9.28).
  const [planes, tarifas, solicitudes] = await Promise.all([
    listarPlanesDelRol("consultor"),
    leerTarifas(),
    contarSolicitudesConsultor(),
  ]);

  return (
    <>
      <SincronizarSesion datos={datos} />
      <SincronizarPlanes planes={planes} tarifas={tarifas} />
      <AppShell rol="consultor" ancho="max-w-6xl" contadores={{ "/consultor/encargos": solicitudes }}>
        {/* RF-84: aviso si entró por la puerta del otro rol */}
        <Suspense>
          <div className="mb-6 empty:hidden">
            <AvisoPuerta rol="consultor" />
          </div>
        </Suspense>
        <main className="flex-1">{children}</main>
        <footer className="mt-10 border-t border-line-2 pt-5 text-center text-xs text-ink-3">
          Plataforma de Gestión de Convocatorias — portal de consultores; la cuenta es real, el resto, datos de ejemplo.
        </footer>
      </AppShell>
      <ModalSuscripcion />
      <ModalCreditos />
    </>
  );
}
