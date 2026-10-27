import { ClipboardList, Plus } from "lucide-react";
import { listarPostulaciones } from "@/lib/postulaciones-servidor";
import { listarProyectos } from "@/lib/proyectos-servidor";
import { diasRestantes } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableroPostulaciones, type ItemTablero } from "@/components/postulaciones/TableroPostulaciones";

// CU-13 1a · Tablero de postulaciones, leído con la sesión de la empresa: la RLS
// solo deja ver las suyas (RN-30), con su convocatoria aunque ya esté cerrada.
// La plataforma no radica (RN-19): se prepara aquí y se presenta en el portal
// de cada entidad.
export default async function PostulacionesPage() {
  const [postulaciones, proyectos] = await Promise.all([listarPostulaciones(), listarProyectos()]);

  const items: ItemTablero[] = postulaciones.map((p) => ({
    id: p.id,
    estado: p.estado,
    nombre: p.convocatoria?.nombre ?? "Convocatoria no disponible",
    entidad: p.convocatoria?.entidadConvocante ?? "—",
    proyecto: proyectos.find((x) => x.id === p.proyectoId)?.nombre ?? "Sin proyecto asociado",
    hechos: p.checklist.filter((i) => i.completado).length,
    total: p.checklist.length,
    dias: p.convocatoria ? diasRestantes(p.convocatoria.fechaCierre) : null,
    cierre: p.convocatoria?.fechaCierre ?? null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Postulaciones"
        descripcion="Prepara aquí; radica en el portal de cada entidad."
        accion={
          <LinkButton href="/convocatorias">
            <Plus className="h-4 w-4" /> Nueva postulación
          </LinkButton>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          titulo="Aún no tienes postulaciones"
          descripcion="Explora el catálogo de convocatorias y postúlate para empezar a hacerles seguimiento aquí."
          accion={
            <LinkButton href="/convocatorias" variant="primary">
              Ver convocatorias
            </LinkButton>
          }
        />
      ) : (
        <TableroPostulaciones items={items} />
      )}
    </div>
  );
}
