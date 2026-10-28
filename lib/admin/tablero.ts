import "server-only";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyColombia } from "@/lib/fechas";
import { listarCuentasYTablero } from "./suscripciones";
import { listarConsultores } from "./consultores";
import { inicioDelPeriodo, postulacionesPorSemana } from "./semanas";
import type { ConsultorAdmin, TableroSuscripciones } from "@/lib/types";

/**
 * Datos del dashboard del panel (RF-42, RF-34, RF-90, RF-108). Todo con la
 * sesión del administrador: la RLS (y `privado.es_admin()` en las funciones)
 * decide; aquí solo se cuentan y agrupan filas reales.
 */
export interface DatosTablero {
  publicadas: number;
  publicadasEsteMes: number;
  borradores: number;
  borradoresSinDocumentos: number;
  cierranPronto: { id: string; nombre: string; entidad: string; dias: number }[];
  suscripciones: TableroSuscripciones;
  /** Cuentas con un plan pagado entre todas las que tienen suscripción (en %); nulo sin cuentas. */
  conversion: number | null;
  /** Postulaciones iniciadas por semana, de la más antigua a la actual (12). */
  semanas: { inicio: string; total: number }[];
  /** Las 12 semanas anteriores, para la variación. */
  totalTrimestreAnterior: number;
  perfilesEnRevision: ConsultorAdmin[];
}

const DIA = 86_400_000;
const SEMANAS = 12;

const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / DIA);

export async function datosTablero(): Promise<DatosTablero> {
  const supabase = await crearClienteServidor();
  const hoy = hoyColombia();
  // Semana que termina hoy (inclusive) y las 23 anteriores, en hora de Colombia.
  const desde = inicioDelPeriodo(hoy, SEMANAS);

  const [{ data: convocatorias, error: eC }, { data: postulaciones, error: eP }, suscripciones, revision] = await Promise.all([
    supabase.from("convocatorias").select("id, nombre, entidad_convocante, estado, fecha_cierre, publicada_at, documentos_convocatoria (count)"),
    supabase.from("postulaciones").select("creada_at").gte("creada_at", desde),
    listarCuentasYTablero(),
    listarConsultores("en_revision"),
  ]);
  if (eC) throw new Error(`Tablero: convocatorias fallaron (${eC.code})`);
  if (eP) throw new Error(`Tablero: postulaciones fallaron (${eP.code})`);

  const filas = (convocatorias ?? []) as unknown as {
    id: string;
    nombre: string;
    entidad_convocante: string;
    estado: string;
    fecha_cierre: string;
    publicada_at: string | null;
    documentos_convocatoria: { count: number }[];
  }[];
  const mes = hoy.slice(0, 7);
  const vigentes = filas.filter((c) => c.estado === "publicada" && c.fecha_cierre >= hoy);
  const borradores = filas.filter((c) => c.estado === "borrador");

  const { semanas, totalTrimestreAnterior } = postulacionesPorSemana(
    (postulaciones ?? []).map((p) => p.creada_at as string),
    hoy,
    SEMANAS
  );

  const conSuscripcion = suscripciones.cuentas.filter((c) => c.suscripcionId);
  const pagadas = conSuscripcion.filter((c) => c.modalidad && c.modalidad !== "trial");

  return {
    publicadas: vigentes.length,
    publicadasEsteMes: filas.filter((c) => c.estado === "publicada" && c.publicada_at?.slice(0, 7) === mes).length,
    borradores: borradores.length,
    borradoresSinDocumentos: borradores.filter((c) => (c.documentos_convocatoria?.[0]?.count ?? 0) === 0).length,
    cierranPronto: vigentes
      .map((c) => ({ id: c.id, nombre: c.nombre, entidad: c.entidad_convocante, dias: diasEntre(hoy, c.fecha_cierre) }))
      .filter((c) => c.dias < 15)
      .sort((a, b) => a.dias - b.dias),
    suscripciones: suscripciones.tablero,
    conversion: conSuscripcion.length > 0 ? Math.round((pagadas.length / conSuscripcion.length) * 100) : null,
    semanas,
    totalTrimestreAnterior,
    perfilesEnRevision: revision,
  };
}
