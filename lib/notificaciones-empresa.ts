import { diasRestantes } from "./utils";
import type { Convocatoria, EncargoDetalle, PostulacionConConvocatoria } from "./types";

/**
 * RF-105 · Avisos de la campana del portal Empresa. Se **calculan** en cada
 * petición con lo que la empresa ya ve (RLS): no hay tabla de notificaciones
 * ni envío de correos. El id es estable para recordar en el navegador cuáles
 * ya vio.
 */
export interface Notificacion {
  id: string;
  texto: string;
  href: string;
  tono: "amber" | "rose" | "sky" | "pri";
}

const DIAS_AVISO = 7;

export function notificacionesEmpresa({
  postulaciones,
  encargos,
  guardadas,
  catalogo,
}: {
  postulaciones: PostulacionConConvocatoria[];
  encargos: EncargoDetalle[];
  guardadas: string[];
  catalogo: Convocatoria[];
}): Notificacion[] {
  const avisos: Notificacion[] = [];
  const postuladas = new Set(postulaciones.map((p) => p.convocatoriaId));

  for (const p of postulaciones) {
    if (p.estado !== "en_preparacion" || !p.convocatoria) continue;
    const dias = diasRestantes(p.convocatoria.fechaCierre);
    if (dias < 0 || dias > DIAS_AVISO) continue;
    const hechos = p.checklist.filter((i) => i.completado).length;
    avisos.push({
      id: `cierre-postulacion-${p.id}-${p.convocatoria.fechaCierre}`,
      texto: `«${p.convocatoria.nombre}» cierra ${dias === 0 ? "hoy" : `en ${dias} ${dias === 1 ? "día" : "días"}`}; tu checklist va en ${hechos}/${p.checklist.length}.`,
      href: `/postulaciones/${p.id}`,
      tono: dias < 3 ? "rose" : "amber",
    });
  }

  const porId = new Map(catalogo.map((c) => [c.id, c]));
  for (const id of guardadas) {
    const c = porId.get(id);
    if (!c || postuladas.has(id)) continue;
    const dias = diasRestantes(c.fechaCierre);
    if (dias < 0 || dias > DIAS_AVISO) continue;
    avisos.push({
      id: `cierre-guardada-${id}-${c.fechaCierre}`,
      texto: `Guardaste «${c.nombre}» y cierra ${dias === 0 ? "hoy" : `en ${dias} ${dias === 1 ? "día" : "días"}`}.`,
      href: `/convocatorias/${id}`,
      tono: dias < 3 ? "rose" : "amber",
    });
  }

  for (const e of encargos) {
    if (e.estado === "completado" && !e.calificacion) {
      avisos.push({
        id: `calificar-${e.id}`,
        texto: `${e.consultor?.nombre ?? "El consultor"} completó «${e.tituloTarea}». Califica su trabajo.`,
        href: "/encargos",
        tono: "pri",
      });
    } else if (e.estado === "en_curso" && e.propuestas.some((p) => p.estado === "propuesta")) {
      avisos.push({
        id: `propuestas-${e.id}-${e.propuestas.filter((p) => p.estado === "propuesta").length}`,
        texto: `Tienes convocatorias propuestas por revisar en «${e.tituloTarea}».`,
        href: "/encargos",
        tono: "sky",
      });
    }
  }

  return avisos;
}
