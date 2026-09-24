import { Navbar } from "@/components/Navbar";
import { ModalSuscripcion } from "@/components/ModalSuscripcion";
import { ModalCreditos } from "@/components/ModalCreditos";
import { SincronizarSesion } from "@/components/SincronizarSesion";
import { SincronizarCatalogo } from "@/components/SincronizarCatalogo";
import { SincronizarProyectos } from "@/components/SincronizarProyectos";
import { SincronizarPostulaciones } from "@/components/SincronizarPostulaciones";
import { Suspense } from "react";
import { AvisoPuerta } from "@/components/identidad/AvisoPuerta";
import { exigirRol } from "@/lib/auth";
import { listarCatalogo, listarCategoriasActivas } from "@/lib/catalogo";
import { listarProyectos } from "@/lib/proyectos-servidor";
import { listarPostulaciones, sinConvocatoria } from "@/lib/postulaciones-servidor";

// Portal Empresa: solo rol empresa (RNF-30, docs/04 §8.2). proxy.ts ya lo
// aplica; esta es la segunda barrera.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const datos = await exigirRol(["empresa"], { ruta: "portal empresa" });
  // Sprint 2 paso 4: el catálogo real, leído con la sesión de la empresa (RN-33).
  // Sprint 3: y sus proyectos y postulaciones (RN-30). Se entregan sin la
  // convocatoria embebida, que las pantallas del store no usan.
  const [convocatorias, categorias, proyectos, postulaciones] = await Promise.all([
    listarCatalogo(),
    listarCategoriasActivas(),
    listarProyectos(),
    listarPostulaciones(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SincronizarSesion datos={datos} />
      <SincronizarCatalogo convocatorias={convocatorias} categorias={categorias} />
      <SincronizarProyectos proyectos={proyectos} />
      <SincronizarPostulaciones postulaciones={postulaciones.map(sinConvocatoria)} />
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* RF-84: aviso si entró por la puerta del otro rol */}
        <Suspense>
          <div className="mb-6 empty:hidden">
            <AvisoPuerta rol="empresa" />
          </div>
        </Suspense>
        {children}
      </main>
      <footer className="border-t border-line-soft py-6 text-center text-xs text-ink-faint">
        Plataforma de Gestión de Convocatorias — la cuenta, la suscripción, el catálogo, los proyectos y las postulaciones son reales; el resto, datos de ejemplo.
      </footer>
      <ModalSuscripcion />
      <ModalCreditos />
    </div>
  );
}
