import { Navbar } from "@/components/Navbar";
import { ModalSuscripcion } from "@/components/ModalSuscripcion";
import { ModalCreditos } from "@/components/ModalCreditos";
import { SincronizarSesion } from "@/components/SincronizarSesion";
import { SincronizarCatalogo } from "@/components/SincronizarCatalogo";
import { SincronizarProyectos } from "@/components/SincronizarProyectos";
import { SincronizarPostulaciones } from "@/components/SincronizarPostulaciones";
import { SincronizarEncargos } from "@/components/SincronizarEncargos";
import { SincronizarDocumentos } from "@/components/SincronizarDocumentos";
import { SincronizarPlanes } from "@/components/SincronizarPlanes";
import { Suspense } from "react";
import { AvisoPuerta } from "@/components/identidad/AvisoPuerta";
import { AvisoSuscripcion } from "@/components/AvisoSuscripcion";
import { AvisoConsentimiento } from "@/components/AvisoConsentimiento";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirRol } from "@/lib/auth";
import { listarCatalogo, listarCategoriasActivas } from "@/lib/catalogo";
import { listarProyectos } from "@/lib/proyectos-servidor";
import { listarPostulaciones, sinConvocatoria } from "@/lib/postulaciones-servidor";
import { aEncargoBase, listarEncargosEmpresa } from "@/lib/encargos-servidor";
import { aDocumentoStore, listarDocumentos } from "@/lib/documentos-servidor";
import { listarPlanesDelRol } from "@/lib/suscripcion-servidor";

// Portal Empresa: solo rol empresa (RNF-30, docs/04 §8.2). proxy.ts ya lo
// aplica; esta es la segunda barrera.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const datos = await exigirRol(["empresa"], { ruta: "portal empresa" });
  // Sprint 2 paso 4: el catálogo real, leído con la sesión de la empresa (RN-33).
  // Sprint 3: y sus proyectos y postulaciones (RN-30). Se entregan sin la
  // convocatoria embebida, que las pantallas del store no usan.
  // Sprint 4 paso 3: y sus encargos. Sprint 5: y sus documentos generados y los
  // planes activos de empresa (RF-82, docs/05 §9.28).
  const supabase = await crearClienteServidor();
  const [convocatorias, categorias, proyectos, postulaciones, encargos, documentos, planes, consentimiento] = await Promise.all([
    listarCatalogo(),
    listarCategoriasActivas(),
    listarProyectos(),
    listarPostulaciones(),
    listarEncargosEmpresa(),
    listarDocumentos(),
    listarPlanesDelRol("empresa"),
    // RF-88: las cuentas anteriores a la casilla del registro aceptan en el portal.
    supabase.from("perfiles").select("consentimiento_datos_at").eq("id", datos.sesion.usuarioId).maybeSingle(),
  ]);
  const faltaConsentimiento = !consentimiento.error && !consentimiento.data?.consentimiento_datos_at;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SincronizarSesion datos={datos} />
      <SincronizarPlanes planes={planes} />
      <SincronizarCatalogo convocatorias={convocatorias} categorias={categorias} />
      <SincronizarProyectos proyectos={proyectos} />
      <SincronizarPostulaciones postulaciones={postulaciones.map(sinConvocatoria)} />
      <SincronizarEncargos encargos={encargos.map(aEncargoBase)} />
      <SincronizarDocumentos documentos={documentos.map(aDocumentoStore)} />
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* RF-84: aviso si entró por la puerta del otro rol */}
        <Suspense>
          <div className="mb-6 empty:hidden">
            <AvisoPuerta rol="empresa" />
          </div>
        </Suspense>
        {faltaConsentimiento && <AvisoConsentimiento />}
        {/* RN-16: aviso de vencimiento y gracia */}
        <AvisoSuscripcion suscripcion={datos.suscripcion} />
        {children}
      </main>
      <footer className="border-t border-line-soft py-6 text-center text-xs text-ink-faint">
        Plataforma de Gestión de Convocatorias — la cuenta, la suscripción, los planes, el catálogo, los proyectos, las postulaciones, los consultores, los encargos y los documentos son reales; el resto, datos de ejemplo.
      </footer>
      <ModalSuscripcion />
      <ModalCreditos />
    </div>
  );
}
