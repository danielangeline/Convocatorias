import type {
  EstadoConvocatoria,
  EstadoEncargo,
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

export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(" ");
}

export const ESTADO_CONVOCATORIA_LABEL: Record<EstadoConvocatoria, string> = {
  borrador: "Borrador",
  publicada: "Publicada",
  despublicada: "Despublicada",
  cerrada: "Cerrada",
};

export const ESTADO_CONVOCATORIA_ESTILO: Record<EstadoConvocatoria, string> = {
  borrador: "bg-slate-100 text-slate-600 ring-slate-200",
  publicada: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  despublicada: "bg-amber-50 text-amber-700 ring-amber-200",
  cerrada: "bg-slate-100 text-slate-500 ring-slate-200",
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
  en_preparacion: "bg-slate-100 text-slate-600 ring-slate-200",
  presentada: "bg-blue-50 text-blue-700 ring-blue-200",
  en_evaluacion: "bg-amber-50 text-amber-700 ring-amber-200",
  aprobada: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rechazada: "bg-red-50 text-red-700 ring-red-200",
  cerrada: "bg-slate-100 text-slate-500 ring-slate-200",
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
  incompleto: "bg-slate-100 text-slate-600 ring-slate-200",
  en_revision: "bg-amber-50 text-amber-700 ring-amber-200",
  aprobado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rechazado: "bg-danger-bg text-danger ring-red-200",
  suspendido: "bg-slate-100 text-slate-500 ring-slate-200",
};

export const ESTADO_ENCARGO_LABEL: Record<EstadoEncargo, string> = {
  esperando_asignacion: "Esperando asignación",
  pendiente: "Pendiente",
  en_curso: "En curso",
  rechazado: "Rechazado",
  completado: "Completado",
  calificado: "Calificado",
  cancelado: "Cancelado",
};

export const ESTADO_ENCARGO_ESTILO: Record<EstadoEncargo, string> = {
  esperando_asignacion: "bg-brick-50 text-brick-700 ring-brick-100",
  pendiente: "bg-amber-50 text-amber-700 ring-amber-200",
  en_curso: "bg-blue-50 text-blue-700 ring-blue-200",
  rechazado: "bg-danger-bg text-danger ring-red-200",
  completado: "bg-primary-50 text-primary-800 ring-primary-100",
  calificado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelado: "bg-slate-100 text-slate-500 ring-slate-200",
};

export const ESTADO_SUSCRIPCION_LABEL: Record<EstadoSuscripcion, string> = {
  trial: "Trial",
  activa: "Activa",
  en_gracia: "En gracia",
  vencida: "Vencida",
  suspendida: "Suspendida",
};

export const ESTADO_SUSCRIPCION_ESTILO: Record<EstadoSuscripcion, string> = {
  trial: "bg-gold-50 text-gold-700 ring-gold-100",
  activa: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  en_gracia: "bg-amber-50 text-amber-700 ring-amber-200",
  vencida: "bg-danger-bg text-danger ring-red-200",
  suspendida: "bg-slate-100 text-slate-500 ring-slate-200",
};

export const TIPO_AYUDA_LABEL: Record<TipoAyudaEncargo, string> = {
  convocatoria_especifica: "Ayuda con una convocatoria específica",
  buscar_convocatoria: "Ayuda para encontrar convocatoria",
};

export const TIPO_AYUDA_ESTILO: Record<TipoAyudaEncargo, string> = {
  convocatoria_especifica: "bg-teal-50 text-teal-700 ring-teal-200",
  buscar_convocatoria: "bg-brick-50 text-brick-700 ring-brick-100",
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
  login_fallido: "bg-amber-50 text-amber-700 ring-amber-200",
  acceso_denegado: "bg-danger-bg text-danger ring-red-200",
  limite_tasa: "bg-brick-50 text-brick-700 ring-brick-100",
  mfa_activado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  mfa_fallido: "bg-danger-bg text-danger ring-red-200",
  admin_invitado: "bg-primary-50 text-primary-700 ring-primary-100",
  invitacion_cancelada: "bg-slate-100 text-slate-600 ring-slate-200",
  admin_revocado: "bg-danger-bg text-danger ring-red-200",
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
