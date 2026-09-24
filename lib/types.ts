export type TipoCategoria = "tipo_proyecto" | "sector" | "tipo_entidad";

export interface Categoria {
  id: string;
  tipo: TipoCategoria;
  nombre: string;
}

export type EstadoConvocatoria = "borrador" | "publicada" | "despublicada" | "cerrada";

export type TipoDocumento = "TDR" | "terminos" | "anexo" | "formato";

export interface Documento {
  id: string;
  tipo: TipoDocumento;
  nombre: string;
  archivo: string;
  pesoKb: number;
}

export type TipoRequisito = "documento" | "condicion";

export interface Requisito {
  id: string;
  descripcion: string;
  tipo: TipoRequisito;
  obligatorio: boolean;
  orden: number;
}

export interface Convocatoria {
  id: string;
  nombre: string;
  entidadConvocante: string;
  descripcion: string;
  // Nulos cuando la entidad no los informa: nunca se rellenan con 0 (RNF-23).
  montoMin: number | null;
  montoMax: number | null;
  /** Cobertura (RN-34): nacional, o los departamentos por código DANE. */
  coberturaNacional: boolean;
  departamentos: string[];
  /** Detalle en texto (municipios, zona): se muestra, nunca se compara. */
  ubicacion: string;
  fechaApertura: string | null; // ISO date
  fechaCierre: string; // ISO date
  estado: EstadoConvocatoria;
  categorias: string[]; // Categoria ids
  documentos: Documento[];
  requisitos: Requisito[];
  // Enlace oficial de postulación (RF-05, RF-09, RF-73) — obligatorio para publicar (RN-01).
  urlPostulacion?: string;
}

export interface Proyecto {
  id: string;
  // Propietario (RN-30): la empresa dueña. Ningún listado se sirve sin filtrar
  // por esta columna; en Supabase es `usuario_id` y la política RLS la exige.
  usuarioId: string;
  nombre: string;
  descripcion: string;
  // Nulo si la empresa no lo ha indicado: nunca se rellena con 0 (RNF-23).
  montoBuscado: number | null;
  /** Departamento donde se ejecuta (código DANE, RN-34); nulo si no se ha indicado. */
  departamento: string | null;
  /** Municipio o detalle en texto: se muestra, nunca se compara. */
  ubicacion: string;
  categorias: string[]; // Categoria ids
  /** 0–100, calculada por la base al guardar (docs/05 §9.17); ausente en los datos de ejemplo. */
  completitud?: number;

  // Contenido (para generación de documentos con IA) — todos opcionales,
  // determinan el indicador de completitud del proyecto.
  problema?: string;
  objetivoGeneral?: string;
  objetivosEspecificos?: string[];
  poblacionBeneficiaria?: string;
  actividades?: string;
  resultadosEsperados?: string;
  duracionMeses?: number;
  presupuestoEstimado?: number;
  experienciaEmpresa?: string;
}

export type EstadoPostulacion =
  | "en_preparacion"
  | "presentada"
  | "en_evaluacion"
  | "aprobada"
  | "rechazada"
  | "cerrada";

export interface ChecklistItem {
  id: string;
  descripcion: string;
  obligatorio: boolean;
  completado: boolean;
}

export interface HistorialItem {
  id: string;
  estadoAnterior: EstadoPostulacion | null;
  estadoNuevo: EstadoPostulacion;
  fecha: string; // ISO date
}

export interface Postulacion {
  id: string;
  usuarioId: string; // Propietario (RN-30) — empresa dueña de la postulación
  convocatoriaId: string;
  proyectoId: string | null;
  estado: EstadoPostulacion;
  checklist: ChecklistItem[];
  historial: HistorialItem[];
}

/**
 * La postulación como la entrega el servidor, con su convocatoria (Sprint 3
 * paso 3). La convocatoria puede ser una cerrada o despublicada: la empresa la
 * sigue viendo porque está ligada a su postulación (docs/05 §9.11, punto 7).
 */
export interface PostulacionConConvocatoria extends Postulacion {
  convocatoria: Convocatoria | null;
  creadaAt: string;
}

export interface Fuente {
  id: string;
  nombre: string;
  tipoEntidad: string;
  url: string;
  activa: boolean;
}

// ---------------------------------------------------------------------------
// Empresas (mínimo, solo para mostrar nombre en paneles de admin)
// ---------------------------------------------------------------------------

export interface Empresa {
  id: string;
  nombre: string;
  // Revelado al consultor solo cuando el encargo pasa a en_curso (RF-70, RN-26).
  correo: string;
}

// ---------------------------------------------------------------------------
// Consultores
// ---------------------------------------------------------------------------

export type RedSocialTipo = "linkedin" | "instagram" | "facebook" | "otra";

export interface RedSocial {
  id: string;
  tipo: RedSocialTipo;
  url: string;
}

export interface ItemPortafolio {
  id: string;
  nombreProyecto: string;
  entidad: string;
  anio: number;
  descripcion: string;
  resultado: string;
}

export type EstadoPerfilConsultor =
  | "incompleto"
  | "en_revision"
  | "aprobado"
  | "rechazado"
  | "suspendido";

export interface PerfilConsultor {
  id: string;
  nombreProfesional: string;
  descripcion: string;
  fotoUrl: string;
  sitioWeb: string;
  redes: RedSocial[];
  especialidades: string[]; // Categoria ids
  portafolio: ItemPortafolio[];
  cvNombre: string;
  estadoPerfil: EstadoPerfilConsultor;
  motivoRechazo?: string;
  esEquipoInterno: boolean;
  ratingPromedio: number;
  totalEncargosCompletados: number;
  // Correo de contacto — visible a empresas solo con solicitud activa (RN-12, ampliado en v5);
  // sitioWeb/redes/cvNombre ya existían pero ahora se ocultan con la misma regla en la UI.
  correo: string;
}

export interface ItemPortafolioPropio {
  nombreProyecto: string;
  entidad: string;
  anio: number | null;
  descripcion: string;
  resultado: string;
}

/**
 * El perfil tal como lo ve y edita su dueño (CU-16, docs/05 §9.20). La foto y
 * la hoja de vida llegan como URL firmada de 15 minutos, no como ruta.
 */
export interface PerfilConsultorPropio {
  id: string;
  nombreProfesional: string;
  descripcion: string;
  sitioWeb: string;
  especialidades: string[];
  redes: Omit<RedSocial, "id">[];
  portafolio: ItemPortafolioPropio[];
  fotoUrl: string | null;
  tieneHojaDeVida: boolean;
  estadoPerfil: EstadoPerfilConsultor;
  motivoRechazo: string | null;
  // CU-27: el consultor ve por qué lo suspendieron (sesión 022).
  motivoSuspension: string | null;
  // RF-88: sin fecha, el editor pide aceptar antes de guardar.
  consentimientoDatos: boolean;
}

// Consultor visto desde el panel (CU-25, CU-27 · docs/05 §9.21). La hoja de
// vida no viaja aquí: se pide por URL firmada al abrirla (RNF-16).
export interface ConsultorAdmin {
  id: string;
  nombreProfesional: string;
  descripcion: string;
  sitioWeb: string;
  fotoUrl: string | null;
  tieneHojaDeVida: boolean;
  estadoPerfil: EstadoPerfilConsultor;
  motivoRechazo: string | null;
  motivoSuspension: string | null;
  suspendidoAt: string | null;
  revisadoAt: string | null;
  esEquipoInterno: boolean;
  ratingPromedio: number;
  totalEncargosCompletados: number;
  encargosActivos: number;
  especialidades: { id: string; nombre: string; tipo: TipoCategoria }[];
  redes: Omit<RedSocial, "id">[];
  portafolio: ItemPortafolioPropio[];
  actualizadoAt: string;
}

// Directorio de consultores visto por la empresa (CU-20, CU-21 · docs/05
// §9.22). Antes de la aceptación no trae ningún dato de contacto.
export interface ConsultorDirectorio {
  id: string;
  nombreProfesional: string;
  fotoUrl: string | null;
  ratingPromedio: number;
  totalEncargosCompletados: number;
  especialidades: { id: string; nombre: string; tipo: TipoCategoria }[];
}

export interface PerfilConsultorPublico extends ConsultorDirectorio {
  descripcion: string;
  portafolio: ItemPortafolioPropio[];
  resenas: { estrellas: number; comentario: string | null; fecha: string }[];
  // RF-80: solo con un encargo en curso de la empresa de la sesión.
  contacto: { sitioWeb: string; redes: Omit<RedSocial, "id">[]; tieneHojaDeVida: boolean } | null;
}

// ---------------------------------------------------------------------------
// Encargos
// ---------------------------------------------------------------------------

export type ViaEncargo = "directorio" | "asignacion_interna";

export type EstadoEncargo =
  | "esperando_asignacion"
  | "pendiente"
  | "en_curso"
  | "rechazado"
  | "completado"
  | "calificado"
  | "cancelado";

// Tipo de ayuda elegido al solicitar consultor (CU-19, RF-28 mod. v5).
export type TipoAyudaEncargo = "convocatoria_especifica" | "buscar_convocatoria";

export interface AvanceEncargo {
  id: string;
  nota: string;
  fecha: string; // ISO date
}

export interface Encargo {
  id: string;
  proyectoId: string;
  empresaId: string;
  consultorId: string | null;
  tituloTarea: string;
  descripcionTarea: string;
  via: ViaEncargo;
  estado: EstadoEncargo;
  // Se completa solo cuando estado = "cancelado" (suspensión del consultor o
  // vencimiento de su suscripción, RN-29, nuevo v5).
  motivoCancelacion?: string;
  avances: AvanceEncargo[];
  fechas: {
    creada: string;
    aceptado: string | null;
    completado: string | null;
  };
  // Contexto adjuntado automáticamente al solicitar (RF-68/69, nuevo v5).
  tipoAyuda: TipoAyudaEncargo;
  convocatoriaId: string | null; // solo si tipoAyuda = convocatoria_especifica
  postulacionId: string | null; // autovinculado si ya existía una postulación en curso
}

export interface Calificacion {
  id: string;
  encargoId: string;
  consultorId: string;
  estrellas: number;
  comentario: string;
  fecha: string; // ISO date
}

// ---------------------------------------------------------------------------
// Planes y suscripciones
// ---------------------------------------------------------------------------

export type RolPlan = "empresa" | "consultor";

export interface Plan {
  id: string;
  nombre: string;
  rol: RolPlan;
  precioMensual: number;
  precioAnual: number;
  creditosIaMensuales: number;
  // Plan del trial (RF-37): no aparece en el comparador.
  esTrial?: boolean;
}

export type ModalidadSuscripcion = "trial" | "mensual" | "anual";

export type EstadoSuscripcion = "trial" | "activa" | "en_gracia" | "vencida" | "suspendida";

export interface Pago {
  id: string;
  suscripcionId: string;
  monto: number;
  fecha: string; // ISO date
}

export interface Suscripcion {
  id: string;
  usuarioId: string;
  planId: string;
  modalidad: ModalidadSuscripcion;
  estado: EstadoSuscripcion;
  fechaInicio: string; // ISO date
  fechaVencimiento: string; // ISO date

  // Créditos de IA
  creditosUsadosPeriodo: number;
  creditosExtra: number; // paquetes comprados, no expiran
  periodoCreditosInicio: string; // ISO date — inicio del ciclo mensual de créditos
}

// ---------------------------------------------------------------------------
// Generación de documentos con IA
// ---------------------------------------------------------------------------

export interface SeccionDocumento {
  id: string;
  titulo: string;
  contenido: string;
}

export type EstadoDocumento = "generado" | "editado" | "exportado";

export interface DocumentoGenerado {
  id: string;
  // Propietario (RN-30): la empresa dueña del proyecto, aunque edite un consultor
  // autorizado. De aquí sale el crédito que se descuenta (RN-28).
  usuarioId: string;
  proyectoId: string;
  convocatoriaId: string;
  titulo: string;
  version: number;
  estado: EstadoDocumento;
  promptVersionId: string;
  secciones: SeccionDocumento[];
  ajustesGratisUsados: number;
  fechaCreacion: string; // ISO date
  fechaActualizacion: string; // ISO date
  // Consultor autorizado a leer/editar (nunca descargar) — RN-22, RN-27, RF-71.
  compartidoConConsultorId: string | null;
  // Quién hizo el último cambio, para auditoría (RNF-11, nuevo v5).
  ultimaEdicionPor: "empresa" | "consultor" | null;
}

export interface PromptVersion {
  id: string;
  version: number;
  contenido: string;
  activa: boolean;
  fechaCreacion: string; // ISO date
}

export interface EstadisticasIA {
  generaciones: number;
  ajustes: number;
  fallidas: number;
  costoEstimadoCOP: number;
}

// ---------------------------------------------------------------------------
// Seguridad y auditoría (CU-38..40, RNF-25..28, nuevo v5)
// ---------------------------------------------------------------------------

export type TipoEventoSeguridad =
  | "login_fallido"
  | "acceso_denegado"
  | "limite_tasa"
  | "mfa_activado"
  | "mfa_fallido"
  // Gestión de administradores (CU-41, RF-65, v6)
  | "admin_invitado"
  | "invitacion_cancelada"
  | "admin_revocado";

export interface EventoSeguridad {
  id: string;
  tipo: TipoEventoSeguridad;
  usuarioNombre: string | null;
  ip: string;
  ruta: string;
  detalle: string;
  // Solo para tipo === "limite_tasa": bloqueo activo si esta fecha es futura.
  bloqueadoHasta: string | null; // ISO datetime
  fecha: string; // ISO datetime
}

// ---------------------------------------------------------------------------
// Sesión (Supabase Auth — RF-01, RF-02, RN-06, RNF-28)
// ---------------------------------------------------------------------------

export type RolUsuario = "empresa" | "consultor" | "administrador";

export interface SesionUsuario {
  usuarioId: string; // auth.uid()
  correo: string;
  nombre: string;
  nombreEmpresa: string | null;
  rol: RolUsuario;
  // Nivel de autenticación de la sesión: aal2 = segundo factor verificado.
  aal: "aal1" | "aal2";
  // Propietario de la plataforma (RN-31): el único que gestiona administradores.
  esPropietario: boolean;
}

// ---------------------------------------------------------------------------
// Gestión de administradores (CU-41, RF-86, RF-87 — docs/05 §9.12)
// ---------------------------------------------------------------------------

export type EstadoInvitacionAdmin = "pendiente" | "aceptada" | "cancelada" | "vencida";

export interface AdministradorListado {
  id: string;
  nombre: string | null;
  correo: string;
  esPropietario: boolean;
  mfaHabilitado: boolean;
  creadoAt: string; // ISO datetime
  invitadoPorNombre: string | null;
  revocadoAt: string | null;
  revocadoPorNombre: string | null;
}

export interface InvitacionAdminListado {
  id: string;
  correo: string;
  nombre: string | null;
  // "pendiente" ya vencida se entrega como "vencida": es lo que ve el Propietario.
  estado: EstadoInvitacionAdmin;
  invitadoPorNombre: string | null;
  creadaAt: string;
  expiraAt: string;
  resueltaAt: string | null;
  tieneCuenta: boolean;
}

// ---------------------------------------------------------------------------
// Catálogo en el panel de administración (Supabase, sesión 011 — RF-04..08)
// ---------------------------------------------------------------------------

export interface FuenteAdmin {
  id: string;
  nombre: string;
  tipoEntidad: string;
  url: string;
  notas: string;
  activa: boolean;
}

export interface CategoriaAdmin {
  id: string;
  tipo: TipoCategoria;
  nombre: string;
  activa: boolean;
  /** Cuántas convocatorias la usan. Con 0 se puede borrar; si no, solo desactivar (RN-07). */
  usos: number;
}

export interface RequisitoAdmin {
  // Sin id: requisito nuevo que aún no se ha guardado.
  id?: string;
  descripcion: string;
  tipo: TipoRequisito;
  obligatorio: boolean;
}

export interface ConvocatoriaAdminListado {
  id: string;
  nombre: string;
  entidadConvocante: string;
  fuenteNombre: string | null;
  montoMin: number | null;
  montoMax: number | null;
  fechaCierre: string;
  estado: EstadoConvocatoria;
}

export interface ConvocatoriaAdmin {
  id: string;
  fuenteId: string | null;
  nombre: string;
  entidadConvocante: string;
  descripcion: string;
  montoMin: number | null;
  montoMax: number | null;
  coberturaNacional: boolean;
  departamentos: string[];
  ubicacion: string;
  fechaApertura: string | null;
  fechaCierre: string;
  urlPostulacion: string;
  estado: EstadoConvocatoria;
  publicadaAt: string | null;
  actualizadoAt: string;
  categorias: string[];
  requisitos: RequisitoAdmin[];
  documentos: DocumentoAdmin[];
}

/** Adjunto de una convocatoria ya guardado en Storage (RF-07, docs/05 §9.14). */
export interface DocumentoAdmin {
  id: string;
  tipo: TipoDocumento;
  nombre: string;
  tipoMime: string;
  tamanoBytes: number | null;
  creadoAt: string;
}

export interface ListadoAdministradores {
  administradores: AdministradorListado[];
  invitaciones: InvitacionAdminListado[];
}

/** Lo que el servidor lee de Supabase para la sesión y entrega al cliente. */
export interface DatosSesion {
  sesion: SesionUsuario;
  suscripcion: Suscripcion | null;
  plan: Plan | null;
  consultor: PerfilConsultor | null;
}
