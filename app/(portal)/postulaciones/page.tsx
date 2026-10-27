import { ClipboardList, Plus } from "lucide-react";
import { listarPostulaciones } from "@/lib/postulaciones-servidor";
import { listarProyectos } from "@/lib/proyectos-servidor";
import { listarEncargosEmpresa } from "@/lib/encargos-servidor";
import { etapaDe, fechaRadicacion } from "@/lib/etapas-postulacion";
import { diasRestantes } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableroPostulaciones, type ItemTablero } from "@/components/postulaciones/TableroPostulaciones";

// CU-13 1a, RF-104 · Tablero de postulaciones, leído con la sesión de la
// empresa: la RLS solo deja ver las suyas (RN-30), con su convocatoria aunque
// ya esté cerrada. Las etapas son una vista sobre los estados reales (RF-83).
// La plataforma no radica (RN-19): se prepara aquí y se presenta en el portal
// de cada entidad. El consultor es el del encargo vivo ligado a la postulación.
export default async function PostulacionesPage() {
  const [postulaciones, proyectos, encargos] = await Promise.all([
    listarPostulaciones(),
    listarProyectos(),
    listarEncargosEmpresa(),
  ]);
  const consultorDe = new Map(
    encargos
      .filter((e) => e.postulacionId && e.consultor && ["pendiente", "en_curso"].includes(e.estado))
      .map((e) => [e.postulacionId as string, e.consultor!.nombre])
  );

  const items: ItemTablero[] = postulaciones.map((p) => {
    const hechos = p.checklist.filter((i) => i.completado).length;
    const radicada = fechaRadicacion(p.historial);
    return {
      id: p.id,
      estado: p.estado,
      etapa: etapaDe(p.estado, hechos, p.checklist.length),
      nombre: p.convocatoria?.nombre ?? "Convocatoria no disponible",
      entidad: p.convocatoria?.entidadConvocante ?? "—",
      proyecto: proyectos.find((x) => x.id === p.proyectoId)?.nombre ?? "Sin proyecto asociado",
      hechos,
      total: p.checklist.length,
      dias: p.convocatoria ? diasRestantes(p.convocatoria.fechaCierre) : null,
      cierre: p.convocatoria?.fechaCierre ?? null,
      radicadaHace: radicada ? Math.max(0, -diasRestantes(radicada.slice(0, 10))) : null,
      consultor: consultorDe.get(p.id) ?? null,
    };
  });

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
