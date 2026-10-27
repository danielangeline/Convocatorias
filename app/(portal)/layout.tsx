import { AppShell } from "@/components/shell/AppShell";
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
import { leerTarifas, listarPlanesDelRol } from "@/lib/suscripcion-servidor";
import { listarGuardadas } from "@/lib/guardadas-servidor";
import { compatibilidadEmpresa, nuevasEstaSemana } from "@/lib/compatibilidad-empresa";
import { notificacionesEmpresa } from "@/lib/notificaciones-empresa";

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
  const [convocatorias, categorias, proyectos, postulaciones, encargos, documentos, planes, consentimiento, tarifas] = await Promise.all([
    listarCatalogo(),
    listarCategoriasActivas(),
    listarProyectos(),
    listarPostulaciones(),
    listarEncargosEmpresa(),
    listarDocumentos(),
    listarPlanesDelRol("empresa"),
    // RF-88: las cuentas anteriores a la casilla del registro aceptan en el portal.
    supabase.from("perfiles").select("consentimiento_datos_at").eq("id", datos.sesion.usuarioId).maybeSingle(),
    leerTarifas(),
  ]);
  // RF-103, RF-105, RF-106: guardadas, avisos de la campana y compatibles nuevas.
  const [guardadas, compat] = await Promise.all([listarGuardadas(), compatibilidadEmpresa()]);
  const sugeridasNuevas = nuevasEstaSemana([...compat.porConvocatoria.values()], convocatorias);
  const notificaciones = notificacionesEmpresa({ postulaciones, encargos, guardadas, catalogo: convocatorias });
  const faltaConsentimiento = !consentimiento.error && !consentimiento.data?.consentimiento_datos_at;

  // Contador del menú: encargos que siguen abiertos (presentación).
  const encargosAbiertos = encargos.filter((e) =>
    ["esperando_asignacion", "pendiente", "en_curso"].includes(e.estado),
  ).length;

  return (
    <>
      <SincronizarSesion datos={datos} />
      <SincronizarPlanes planes={planes} tarifas={tarifas} />
      <SincronizarCatalogo convocatorias={convocatorias} categorias={categorias} />
      <SincronizarProyectos proyectos={proyectos} />
      <SincronizarPostulaciones postulaciones={postulaciones.map(sinConvocatoria)} />
      <SincronizarEncargos encargos={encargos.map(aEncargoBase)} />
      <SincronizarDocumentos documentos={documentos.map(aDocumentoStore)} />
      <AppShell
        rol="empresa"
        contadores={{ "/encargos": encargosAbiertos, "/sugeridas": sugeridasNuevas }}
        notificaciones={notificaciones}
      >
        {/* RF-84: aviso si entró por la puerta del otro rol */}
        <Suspense>
          <div className="mb-6 empty:hidden">
            <AvisoPuerta rol="empresa" />
          </div>
        </Suspense>
        {faltaConsentimiento && <AvisoConsentimiento />}
        {/* RN-16: aviso de vencimiento y gracia */}
        <AvisoSuscripcion suscripcion={datos.suscripcion} />
        <main className="flex-1">{children}</main>
      </AppShell>
      <ModalSuscripcion />
      <ModalCreditos />
    </>
  );
}
