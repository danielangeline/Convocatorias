import type {
  EstadoConvocatoria,
  OrigenConvocatoria,
  TipoConvocatoria,
  EstadoEncargo,
  EstadoPropuesta,
  EstadoPerfilConsultor,
  EstadoPostulacion,
  EstadoSuscripcion,
  TipoAyudaEncargo,
  TipoEventoSeguridad,
} from "./types";

export function formatCOP(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso + "T00:00:00"));
}

export function formatFechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso + "T00:00:00"));
}

/**
 * Hoy, a medianoche. Antes era una constante congelada en 2026-08-24, lo que
 * hacía envejecer la demo: las convocatorias "vigentes" iban quedando en el
 * pasado. Las fechas del conjunto de ejemplo ahora son relativas (ver
 * `lib/mock-data.ts`), así que esto puede seguir al reloj real.
 */
function hoyMedianoche(): Date {
  const f = new Date();
  f.setHours(0, 0, 0, 0);
  return f;
}

export function diasRestantes(fechaCierre: string): number {
  const cierre = new Date(fechaCierre + "T00:00:00");
  const diff = cierre.getTime() - hoyMedianoche().getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

// Tonos de badge sobre los tokens del rediseño (claro y oscuro).
const TONO_AMBER = "bg-[color-mix(in_oklch,var(--amber)_16%,transparent)] text-[color-mix(in_oklch,var(--amber)_62%,var(--ink))]";
const TONO_SKY = "bg-[color-mix(in_oklch,var(--sky)_16%,transparent)] text-[color-mix(in_oklch,var(--sky)_65%,var(--ink))]";
const TONO_ROSE = "bg-[color-mix(in_oklch,var(--rose)_16%,transparent)] text-[color-mix(in_oklch,var(--rose)_65%,var(--ink))]";
const TONO_VIOLET = "bg-[color-mix(in_oklch,var(--violet)_16%,transparent)] text-[color-mix(in_oklch,var(--violet)_65%,var(--ink))]";
const TONO_PRI = "bg-pri-soft text-pri-text";
const TONO_NEUTRO = "bg-surface-2 text-ink-2";

export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(" ");
}

export const TIPO_CONVOCATORIA_LABEL: Record<TipoConvocatoria, string> = {
  fondo: "Fondos",
  beneficio_tributario: "Beneficio tributario",
};

export const ORIGEN_CONVOCATORIA_LABEL: Record<OrigenConvocatoria, string> = {
  publico: "Público",
  privado: "Privado",
  cooperacion: "Cooperación",
};

export const ESTADO_CONVOCATORIA_LABEL: Record<EstadoConvocatoria, string> = {
  borrador: "Borrador",
  publicada: "Publicada",
  despublicada: "Despublicada",
  cerrada: "Cerrada",
};

export const ESTADO_CONVOCATORIA_ESTILO: Record<EstadoConvocatoria, string> = {
  borrador: TONO_NEUTRO,
  publicada: TONO_PRI,
  despublicada: TONO_AMBER,
  cerrada: TONO_NEUTRO,
};

export const ESTADO_POSTULACION_LABEL: Record<EstadoPostulacion, string> = {
  en_preparacion: "En preparación",
  presentada: "Presentada",
  en_evaluacion: "En evaluación",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  cerrada: "Cerrada",
};

export const ESTADO_POSTULACION_ESTILO: Record<EstadoPostulacion, string> = {
  en_preparacion: TONO_NEUTRO,
  presentada: TONO_SKY,
  en_evaluacion: TONO_AMBER,
  aprobada: TONO_PRI,
  rechazada: TONO_ROSE,
  cerrada: TONO_NEUTRO,
};

export const ESTADO_POSTULACION_ORDEN: EstadoPostulacion[] = [
  "en_preparacion",
  "presentada",
  "en_evaluacion",
  "aprobada",
  "rechazada",
  "cerrada",
];

/**
 * RF-83: grafo de transiciones de la postulación. La interfaz solo ofrece los
 * estados alcanzables desde el actual; al conectar el backend, este mismo mapa
 * es el que valida `POST /api/postulaciones/[id]/estado` — la regla no puede
 * vivir únicamente en el `<select>` (RNF-20).
 */
export const TRANSICIONES_POSTULACION: Record<EstadoPostulacion, EstadoPostulacion[]> = {
  en_preparacion: ["presentada", "cerrada"],
  presentada: ["en_evaluacion", "cerrada"],
  en_evaluacion: ["aprobada", "rechazada", "cerrada"],
  aprobada: ["cerrada"],
  rechazada: ["cerrada"],
  cerrada: [],
};

/** Estados que terminan el ciclo: se confirman antes de aplicarse (RF-83). */
export const ESTADOS_POSTULACION_TERMINALES: EstadoPostulacion[] = ["cerrada"];

export function transicionPermitida(desde: EstadoPostulacion, hacia: EstadoPostulacion): boolean {
  return TRANSICIONES_POSTULACION[desde].includes(hacia);
}

export function estadosAlcanzables(desde: EstadoPostulacion): EstadoPostulacion[] {
  return TRANSICIONES_POSTULACION[desde];
}

export const TIPO_DOCUMENTO_LABEL: Record<string, string> = {
  TDR: "Términos de referencia (TDR)",
  terminos: "Términos y condiciones",
  anexo: "Anexo",
  formato: "Formato",
};

export const TIPO_CATEGORIA_LABEL: Record<string, string> = {
  tipo_proyecto: "Tipo de proyecto",
  sector: "Sector",
  tipo_entidad: "Tipo de entidad",
};

// ---------------------------------------------------------------------------
// Consultores, encargos y suscripciones
// ---------------------------------------------------------------------------

export const ESTADO_PERFIL_LABEL: Record<EstadoPerfilConsultor, string> = {
  incompleto: "Incompleto",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  suspendido: "Suspendido",
};

export const ESTADO_PERFIL_ESTILO: Record<EstadoPerfilConsultor, string> = {
  incompleto: TONO_NEUTRO,
  en_revision: TONO_AMBER,
  aprobado: TONO_PRI,
  rechazado: TONO_ROSE,
  suspendido: TONO_NEUTRO,
};

export const ESTADO_ENCARGO_LABEL: Record<EstadoEncargo, string> = {
  esperando_asignacion: "Esperando a nuestro equipo",
  atendido: "Atendida por nuestro equipo",
  pendiente: "Pendiente",
  en_curso: "En curso",
  rechazado: "Rechazado",
  completado: "Completado",
  calificado: "Calificado",
  cancelado: "Cancelado",
};

export const ESTADO_ENCARGO_ESTILO: Record<EstadoEncargo, string> = {
  esperando_asignacion: TONO_ROSE,
  atendido: TONO_PRI,
  pendiente: TONO_AMBER,
  en_curso: TONO_SKY,
  rechazado: TONO_ROSE,
  completado: TONO_PRI,
  calificado: TONO_PRI,
  cancelado: TONO_NEUTRO,
};

export const ESTADO_SUSCRIPCION_LABEL: Record<EstadoSuscripcion, string> = {
  trial: "Trial",
  activa: "Activa",
  en_gracia: "En gracia",
  vencida: "Vencida",
  suspendida: "Suspendida",
};

export const ESTADO_SUSCRIPCION_ESTILO: Record<EstadoSuscripcion, string> = {
  trial: TONO_SKY,
  activa: TONO_PRI,
  en_gracia: TONO_AMBER,
  vencida: TONO_ROSE,
  suspendida: TONO_NEUTRO,
};

export const ESTADO_PROPUESTA_LABEL: Record<EstadoPropuesta, string> = {
  propuesta: "Propuesta",
  elegida: "Elegida por la empresa",
  retirada: "Retirada",
  descartada: "No elegida",
};

export const ESTADO_PROPUESTA_ESTILO: Record<EstadoPropuesta, string> = {
  propuesta: TONO_PRI,
  elegida: TONO_PRI,
  retirada: TONO_NEUTRO,
  descartada: TONO_NEUTRO,
};

export const TIPO_AYUDA_LABEL: Record<TipoAyudaEncargo, string> = {
  convocatoria_especifica: "Ayuda con una convocatoria específica",
  buscar_convocatoria: "Ayuda para encontrar convocatoria",
};

export const TIPO_AYUDA_ESTILO: Record<TipoAyudaEncargo, string> = {
  convocatoria_especifica: TONO_VIOLET,
  buscar_convocatoria: TONO_ROSE,
};

export const TIPO_EVENTO_SEGURIDAD_LABEL: Record<TipoEventoSeguridad, string> = {
  login_fallido: "Login fallido",
  acceso_denegado: "Acceso denegado",
  limite_tasa: "Límite de tasa",
  mfa_activado: "MFA activado",
  mfa_fallido: "MFA fallido",
  admin_invitado: "Admin invitado",
  invitacion_cancelada: "Invitación cancelada",
  admin_revocado: "Admin revocado",
};

export const TIPO_EVENTO_SEGURIDAD_ESTILO: Record<TipoEventoSeguridad, string> = {
  login_fallido: TONO_AMBER,
  acceso_denegado: TONO_ROSE,
  limite_tasa: TONO_ROSE,
  mfa_activado: TONO_PRI,
  mfa_fallido: TONO_ROSE,
  admin_invitado: TONO_PRI,
  invitacion_cancelada: TONO_NEUTRO,
  admin_revocado: TONO_ROSE,
};

export function formatFechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function diasRestantesHasta(fechaIso: string): number {
  const fecha = new Date(fechaIso + "T00:00:00");
  const diff = fecha.getTime() - hoyMedianoche().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatRating(valor: number): string {
  return valor > 0 ? valor.toFixed(1) : "Sin calificar";
}

export function agregarMeses(fechaIso: string, meses: number): string {
  const fecha = new Date(fechaIso + "T00:00:00");
  fecha.setMonth(fecha.getMonth() + meses);
  return fecha.toISOString().slice(0, 10);
}

/** Formatea un monto COP en notación corta en español (mill. / mil M). */
/**
 * Rango de una convocatoria sin inventar cifras (RNF-23): si la entidad no
 * informó un extremo, no se escribe. "$ 1 – $ 5", "Hasta $ 5", "Desde $ 1".
 */
export function formatRangoCOP(min: number | null, max: number | null): string {
  if (min != null && max != null) return min === max ? formatCOP(max) : `${formatCOP(min)} – ${formatCOP(max)}`;
  if (max != null) return `Hasta ${formatCOP(max)}`;
  if (min != null) return `Desde ${formatCOP(min)}`;
  return "Monto no informado";
}

export function formatCOPCorto(valor: number): string {
  if (valor >= 1_000_000_000_000) {
    return `$${(valor / 1_000_000_000_000).toFixed(1).replace(".", ",")} billones`;
  }
  if (valor >= 1_000_000_000) {
    return `$${(valor / 1_000_000_000).toFixed(1).replace(".", ",")} mil millones`;
  }
  if (valor >= 1_000_000) {
    return `$${Math.round(valor / 1_000_000).toLocaleString("es-CO")} millones`;
  }
  return formatCOP(valor);
}
