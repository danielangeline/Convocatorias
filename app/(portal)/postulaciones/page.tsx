import Link from "next/link";
import { ClipboardList, MapPin } from "lucide-react";
import { listarPostulaciones } from "@/lib/postulaciones-servidor";
import { listarProyectos } from "@/lib/proyectos-servidor";
import { formatFecha, ESTADO_POSTULACION_LABEL, ESTADO_POSTULACION_ESTILO } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { textoCobertura } from "@/lib/departamentos";

// CU-13 1a · Panel de postulaciones, leído con la sesión de la empresa: la RLS
// solo deja ver las suyas (RN-30), con su convocatoria aunque ya esté cerrada.
export default async function PostulacionesPage() {
  const [postulaciones, proyectos] = await Promise.all([listarPostulaciones(), listarProyectos()]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Mis postulaciones</h1>
        <p className="text-sm text-ink-soft">Haz seguimiento al estado de cada postulación activa.</p>
      </div>

      {postulaciones.length === 0 ? (
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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {postulaciones.map((post) => {
            const convocatoria = post.convocatoria;
            const proyecto = proyectos.find((p) => p.id === post.proyectoId);
            const total = post.checklist.length;
            const completados = post.checklist.filter((i) => i.completado).length;
            const porcentaje = total ? Math.round((completados / total) * 100) : 0;

            return (
              <Link
                key={post.id}
                href={`/postulaciones/${post.id}`}
                className="flex flex-col rounded-2xl border border-line p-5 transition-colors hover:border-primary-200 hover:bg-primary-50/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge className={ESTADO_POSTULACION_ESTILO[post.estado]}>
                    {ESTADO_POSTULACION_LABEL[post.estado]}
                  </Badge>
                </div>

                <h3 className="mt-3 font-display text-base font-semibold leading-snug text-ink">
                  {convocatoria?.nombre ?? "Convocatoria no disponible"}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {proyecto ? proyecto.nombre : "Sin proyecto asociado"}
                </p>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-ink-faint">
                    <span>Progreso del checklist</span>
                    <span className="font-tabular font-semibold text-ink">{porcentaje}%</span>
                  </div>
                  <ProgressBar porcentaje={porcentaje} />
                </div>

                {convocatoria && (
                  <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-4 text-xs text-ink-faint">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {textoCobertura(convocatoria)}
                    </span>
                    <span>Cierra: {formatFecha(convocatoria.fechaCierre)}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
