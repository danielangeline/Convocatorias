import "server-only";
import { cache } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServicio, crearClienteServidor } from "@/lib/supabase/servidor";
import { COLUMNAS_CONVOCATORIA, aConvocatoria, type FilaConvocatoria } from "@/lib/catalogo";
import { COLUMNAS_PROYECTO, aProyecto, type FilaProyecto } from "@/lib/proyectos-servidor";
import { contenidoASecciones, pendientesDe, seccionesAContenido } from "@/lib/documentos";
import { obtenerSesion } from "@/lib/auth";
import { PLAZO_IA_MS, ErrorIA, redactar } from "@/lib/ia";
import { contextoAjuste, contextoGeneracion } from "@/lib/ia/contexto";
import { textoDeAdjuntos } from "@/lib/ia/adjuntos";
import { fechaColombia } from "@/lib/fechas";
import type { DocumentoGenerado, DocumentoServidor, EstadoDocumento } from "@/lib/types";

/**
 * Documentos generados con IA (CU-33, CU-34 · docs/05 §9.26 · Sprint 5).
 *
 * - **Leer y editar** van con la sesión del usuario: la RLS de §9.5 decide si
 *   es suyo o si es el consultor autorizado con encargo en curso (RN-27).
 * - **Generar, ajustar y exportar** cobran o cambian lo que el cliente no
 *   puede escribir: pasan por las funciones de la base con service_role, que
 *   reciben el usuario de la sesión ya verificada y repiten cada regla
 *   (RNF-20). Aquí se valida la forma, se llama a la IA y se traduce cada
 *   clave a su código HTTP.
 */

type Resultado<T> = { ok: true; datos: T } | { ok: false; status: number; error: string };
type Cuerpo = Record<string, unknown> | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CONTENIDO = 200_000;
const MAX_INDICACION = 1_000;
const MAX_TOKENS_SALIDA = 16_000;

const COLUMNAS = `id, usuario_id, proyecto_id, convocatoria_id, postulacion_id, titulo, contenido, pendientes, estado,
  version, ajustes_usados, compartido_con_consultor_id, ultima_edicion_por, creado_at, actualizado_at,
  proyectos (nombre), convocatorias (nombre, entidad_convocante)`;

type Fila = {
  id: string;
  usuario_id: string;
  proyecto_id: string;
  convocatoria_id: string;
  postulacion_id: string | null;
  titulo: string | null;
  contenido: string | null;
  pendientes: string[];
  estado: EstadoDocumento | "generando" | "error";
  version: number;
  ajustes_usados: number;
  compartido_con_consultor_id: string | null;
  ultima_edicion_por: string | null;
  creado_at: string;
  actualizado_at: string;
  proyectos: { nombre: string } | null;
  convocatorias: { nombre: string; entidad_convocante: string } | null;
};

function aDocumento(f: Fila): DocumentoServidor {
  return {
    id: f.id,
    usuarioId: f.usuario_id,
    proyectoId: f.proyecto_id,
    convocatoriaId: f.convocatoria_id,
    postulacionId: f.postulacion_id,
    titulo: f.titulo ?? "Documento sin título",
    secciones: contenidoASecciones(f.contenido),
    pendientes: f.pendientes,
    estado: f.estado as EstadoDocumento,
    version: f.version,
    ajustesUsados: f.ajustes_usados,
    compartidoConConsultorId: f.compartido_con_consultor_id,
    ultimaEdicionPor: f.ultima_edicion_por === null ? null : f.ultima_edicion_por === f.usuario_id ? "empresa" : "consultor",
    creadoAt: f.creado_at,
    actualizadoAt: f.actualizado_at,
    proyectoNombre: f.proyectos?.nombre ?? "",
    convocatoriaNombre: f.convocatorias?.nombre ?? "",
    entidadConvocante: f.convocatorias?.entidad_convocante ?? "",
  };
}

const TERMINADOS = ["generado", "editado", "exportado"];

// El consultor autorizado lee el documento, pero quizá no la convocatoria (un
// encargo de búsqueda, RN-25): los nombres se completan con service_role
// después de que la RLS ya decidió qué filas puede ver.
async function completarNombres(filas: Fila[]): Promise<Fila[]> {
  const faltan = [...new Set(filas.filter((f) => !f.convocatorias || !f.proyectos).flatMap((f) => [f.convocatoria_id, f.proyecto_id]))];
  if (faltan.length === 0) return filas;
  const servicio = crearClienteServicio();
  const [{ data: cs }, { data: ps }] = await Promise.all([
    servicio.from("convocatorias").select("id, nombre, entidad_convocante").in("id", faltan),
    servicio.from("proyectos").select("id, nombre").in("id", faltan),
  ]);
  const conv = new Map((cs ?? []).map((c) => [c.id, c]));
  const proy = new Map((ps ?? []).map((p) => [p.id, p]));
  return filas.map((f) => ({
    ...f,
    convocatorias: f.convocatorias ?? conv.get(f.convocatoria_id) ?? null,
    proyectos: f.proyectos ?? proy.get(f.proyecto_id) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Lectura: la empresa con la RLS; el consultor, solo por funciones del
// servidor que registran su lectura en la misma llamada (RF-79, migración
// 20261019300000: ya no tiene política de lectura directa).
// ---------------------------------------------------------------------------

async function consultorDeSesion(): Promise<string | null> {
  const datos = await obtenerSesion();
  return datos?.sesion.rol === "consultor" ? datos.sesion.usuarioId : null;
}

/**
 * RN-30 · Los documentos de la sesión: la última versión de cada par
 * proyecto-convocatoria. Para el consultor, solo los que le autorizaron con su
 * encargo en curso (RN-27), sin el contenido.
 */
export const listarDocumentos = cache(async (): Promise<DocumentoServidor[]> => {
  const consultor = await consultorDeSesion();
  if (consultor) {
    const { data, error } = await crearClienteServicio().rpc("documentos_del_consultor", { p_usuario: consultor });
    if (error) {
      console.error("Documentos: no se pudieron listar los del consultor", error.code, error.message);
      return [];
    }
    type FilaLista = Pick<Fila, "id" | "proyecto_id" | "convocatoria_id" | "titulo" | "estado" | "version" | "pendientes" | "actualizado_at">;
    const filas = (data as FilaLista[]).map(
      (f): Fila => ({
        ...f,
        usuario_id: "",
        postulacion_id: null,
        contenido: null,
        ajustes_usados: 0,
        compartido_con_consultor_id: consultor,
        ultima_edicion_por: null,
        creado_at: f.actualizado_at,
        proyectos: null,
        convocatorias: null,
      })
    );
    return (await completarNombres(filas)).map(aDocumento);
  }
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("documentos_generados")
    .select(COLUMNAS)
    .in("estado", TERMINADOS)
    .order("version", { ascending: false });
  if (error) {
    console.error("Documentos: no se pudieron listar", error.code, error.message);
    return [];
  }
  const vistos = new Set<string>();
  return (await completarNombres(data as unknown as Fila[]))
    .filter((f) => {
      const par = `${f.proyecto_id}:${f.convocatoria_id}`;
      if (vistos.has(par)) return false;
      vistos.add(par);
      return true;
    })
    .map(aDocumento)
    .sort((a, b) => b.actualizadoAt.localeCompare(a.actualizadoAt));
});

/**
 * El documento, si la sesión puede verlo; null si para ella no existe. La
 * lectura del consultor autorizado queda registrada en la base (RF-79).
 */
export const obtenerDocumento = cache(async (id: string): Promise<DocumentoServidor | null> => {
  if (!UUID.test(id)) return null;
  const consultor = await consultorDeSesion();
  if (consultor) {
    const { data, error } = await crearClienteServicio().rpc("leer_documento", { p_usuario: consultor, p_documento: id });
    if (error) console.error("Documentos: el consultor no pudo leer", error.code, error.message);
    const fila = (data as Omit<Fila, "proyectos" | "convocatorias">[] | null)?.[0];
    return fila ? aDocumento((await completarNombres([{ ...fila, proyectos: null, convocatorias: null }]))[0]) : null;
  }
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("documentos_generados").select(COLUMNAS).eq("id", id).in("estado", TERMINADOS).maybeSingle();
  if (error) console.error("Documentos: no se pudo leer", error.code, error.message);
  return data ? aDocumento((await completarNombres([data as unknown as Fila]))[0]) : null;
});

// ---------------------------------------------------------------------------
// Rechazos de la base → HTTP
// ---------------------------------------------------------------------------

const RECHAZOS: Record<string, { status: number; error: string }> = {
  no_es_empresa: { status: 403, error: "Solo una cuenta de empresa puede generar documentos." },
  proyecto_no_existe: { status: 404, error: "El proyecto no existe." },
  convocatoria_no_existe: { status: 404, error: "La convocatoria no existe." },
  convocatoria_no_vigente: {
    status: 409,
    error: "Esta convocatoria ya no está abierta: está cerrada o despublicada y no admite nuevos documentos.",
  },
  sin_suscripcion: { status: 402, error: "Necesitas una suscripción vigente para usar la IA." },
  sin_creditos: { status: 402, error: "No te quedan créditos de IA. Puedes pedir un paquete adicional o un plan con más créditos." },
  sin_plantilla: { status: 503, error: "La generación no está disponible en este momento. Intenta más tarde." },
  documento_no_existe: { status: 404, error: "El documento no existe." },
  generacion_no_encontrada: { status: 409, error: "La generación ya no estaba en curso. Intenta de nuevo." },
  ajuste_concurrente: { status: 409, error: "Otro ajuste se aplicó mientras tanto. Recarga el documento e intenta de nuevo." },
  ajuste_en_curso: { status: 409, error: "Ya hay un ajuste en curso sobre este documento. Espera a que termine." },
  ajuste_no_reservado: { status: 409, error: "El ajuste se interrumpió. Intenta de nuevo." },
};

function rechazo(error: PostgrestError, accion: string): { ok: false; status: number; error: string } {
  const conocido = error.hint ? RECHAZOS[error.hint] : undefined;
  if (conocido) return { ok: false, ...conocido };
  console.error(`Documentos: ${accion} falló`, error.code, error.message);
  return { ok: false, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
}

/** RF-52 · Costo estimado en USD con los precios de la plantilla. */
function costo(entrada: number | null, salida: number | null, precioEntrada: number, precioSalida: number): number | null {
  if (entrada === null && salida === null) return null;
  return Number((((entrada ?? 0) * precioEntrada + (salida ?? 0) * precioSalida) / 1_000_000).toFixed(6));
}

function mensajeFallo(e: unknown): { status: number; error: string; registro: string; entrada: number | null; salida: number | null } {
  const base = " No se descontó ningún crédito. Puedes intentarlo de nuevo.";
  if (e instanceof ErrorIA) {
    return {
      status: e.motivo === "plazo" ? 504 : 502,
      error:
        e.motivo === "plazo"
          ? `La IA tardó demasiado en responder.${base}`
          : e.motivo === "configuracion"
            ? `La generación no está disponible en este momento.${base}`
            : `No pudimos generar el documento.${base}`,
      registro: e.message,
      entrada: e.tokensEntrada,
      salida: e.tokensSalida,
    };
  }
  return { status: 502, error: `No pudimos generar el documento.${base}`, registro: e instanceof Error ? e.message : String(e), entrada: null, salida: null };
}

// Lecturas con service_role, ya autorizadas por la función de la base.
async function proyectoYConvocatoria(proyectoId: string, convocatoriaId: string) {
  const supabase = crearClienteServicio();
  const [{ data: p }, { data: c }] = await Promise.all([
    supabase.from("proyectos").select(`${COLUMNAS_PROYECTO}, perfiles (nombre_empresa)`).eq("id", proyectoId).maybeSingle(),
    supabase.from("convocatorias").select(COLUMNAS_CONVOCATORIA).eq("id", convocatoriaId).maybeSingle(),
  ]);
  const fila = p as unknown as (FilaProyecto & { perfiles: { nombre_empresa: string | null } | null }) | null;
  return {
    proyecto: fila ? aProyecto(fila) : null,
    convocatoria: c ? aConvocatoria(c as unknown as FilaConvocatoria) : null,
    empresa: fila?.perfiles?.nombre_empresa ?? null,
  };
}

// ---------------------------------------------------------------------------
// Generar (CU-33, RF-48, RF-52, RF-55..57, RF-61, RF-62)
// ---------------------------------------------------------------------------

type Inicio = {
  documento_id: string;
  version: number;
  plantilla_id: string;
  plantilla: string;
  modelo: string;
  precio_entrada_usd_mtok: number;
  precio_salida_usd_mtok: number;
  tope_caracteres_tdr: number;
};

export async function generarDocumento(usuarioId: string, cuerpo: Cuerpo): Promise<Resultado<{ id: string }>> {
  const proyectoId = cuerpo?.proyectoId;
  const convocatoriaId = cuerpo?.convocatoriaId;
  if (typeof proyectoId !== "string" || !UUID.test(proyectoId)) return { ok: false, status: 400, error: "Elige un proyecto." };
  if (typeof convocatoriaId !== "string" || !UUID.test(convocatoriaId)) return { ok: false, status: 400, error: "Falta la convocatoria." };

  const servicio = crearClienteServicio();
  // Reserva el crédito y comprueba rol, propiedad, suscripción, cupo y vigencia (RNF-20, RF-78).
  const { data: inicio, error: eInicio } = await servicio
    .rpc("iniciar_generacion", { p_usuario: usuarioId, p_proyecto: proyectoId, p_convocatoria: convocatoriaId })
    .single<Inicio>();
  if (eInicio) return rechazo(eInicio, "iniciar la generación");

  const t0 = Date.now();
  const precioEntrada = Number(inicio.precio_entrada_usd_mtok);
  const precioSalida = Number(inicio.precio_salida_usd_mtok);
  try {
    const { proyecto, convocatoria, empresa } = await proyectoYConvocatoria(proyectoId, convocatoriaId);
    if (!proyecto || !convocatoria) throw new Error("No se pudo leer el proyecto o la convocatoria");
    const adjuntos = await textoDeAdjuntos(convocatoriaId, inicio.tope_caracteres_tdr);
    if (adjuntos.neutralizadas > 0) {
      console.warn(`IA: ${adjuntos.neutralizadas} líneas neutralizadas en los adjuntos de ${convocatoriaId} (RNF-31)`);
    }

    const r = await redactar({
      modelo: inicio.modelo,
      instrucciones: inicio.plantilla,
      mensaje: contextoGeneracion({ proyecto, empresa, convocatoria, adjuntos: adjuntos.adjuntos }),
      maxTokensSalida: MAX_TOKENS_SALIDA,
      plazoMs: PLAZO_IA_MS,
    });

    const contenido = seccionesAContenido(r.secciones);
    const { error: eFin } = await servicio.rpc("completar_generacion", {
      p_documento: inicio.documento_id,
      p_titulo: r.titulo.slice(0, 300),
      p_contenido: contenido,
      p_pendientes: pendientesDe(contenido),
      p_tokens_entrada: r.tokensEntrada,
      p_tokens_salida: r.tokensSalida,
      p_costo: costo(r.tokensEntrada, r.tokensSalida, precioEntrada, precioSalida),
      p_modelo: inicio.modelo,
      p_duracion_ms: Date.now() - t0,
    });
    if (eFin) {
      await servicio.rpc("fallar_generacion", {
        p_documento: inicio.documento_id,
        p_mensaje: `No se pudo guardar: ${eFin.hint ?? eFin.message}`,
        p_tokens_entrada: r.tokensEntrada,
        p_tokens_salida: r.tokensSalida,
        p_costo: costo(r.tokensEntrada, r.tokensSalida, precioEntrada, precioSalida),
        p_modelo: inicio.modelo,
        p_duracion_ms: Date.now() - t0,
      });
      return rechazo(eFin, "guardar la generación");
    }
    return { ok: true, datos: { id: inicio.documento_id } };
  } catch (e) {
    const f = mensajeFallo(e);
    console.error("IA: la generación falló", f.registro);
    await servicio.rpc("fallar_generacion", {
      p_documento: inicio.documento_id,
      p_mensaje: f.registro,
      p_tokens_entrada: f.entrada,
      p_tokens_salida: f.salida,
      p_costo: costo(f.entrada, f.salida, precioEntrada, precioSalida),
      p_modelo: inicio.modelo,
      p_duracion_ms: Date.now() - t0,
    });
    return { ok: false, status: f.status, error: f.error };
  }
}

// ---------------------------------------------------------------------------
// Editar (RF-58): con la sesión; la RLS y el trigger de §9.5 deciden
// ---------------------------------------------------------------------------

export async function guardarEdicion(id: string, cuerpo: Cuerpo): Promise<Resultado<DocumentoServidor>> {
  if (!UUID.test(id)) return { ok: false, status: 404, error: "El documento no existe." };
  const secciones = cuerpo?.secciones;
  if (
    !Array.isArray(secciones) ||
    secciones.length === 0 ||
    !secciones.every((s) => s && typeof s.titulo === "string" && s.titulo.trim() && typeof s.contenido === "string")
  ) {
    return { ok: false, status: 400, error: "El documento debe tener al menos una sección con título." };
  }
  const contenido = seccionesAContenido(secciones as { titulo: string; contenido: string }[]);
  if (contenido.length > MAX_CONTENIDO) return { ok: false, status: 400, error: "El documento es demasiado largo." };

  const cambios: Record<string, unknown> = { contenido, pendientes: pendientesDe(contenido) };
  if (cuerpo?.titulo !== undefined) {
    if (typeof cuerpo.titulo !== "string" || !cuerpo.titulo.trim() || cuerpo.titulo.length > 300) {
      return { ok: false, status: 400, error: "El título no es válido." };
    }
    cambios.titulo = cuerpo.titulo.trim();
  }

  const consultor = await consultorDeSesion();
  if (consultor) {
    // RN-22: el consultor no cambia el título; solo el contenido, por el servidor.
    if (cambios.titulo !== undefined) return { ok: false, status: 403, error: "No puedes cambiar eso en este documento." };
    const { error } = await crearClienteServicio().rpc("editar_documento_consultor", {
      p_usuario: consultor,
      p_documento: id,
      p_contenido: contenido,
    });
    if (error) return rechazo(error, "guardar la edición del consultor");
    return releerSinTraza(id);
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("documentos_generados")
    .update(cambios)
    .eq("id", id)
    .in("estado", TERMINADOS)
    .select(COLUMNAS)
    .maybeSingle();
  if (error) {
    if (error.code === "42501") return { ok: false, status: 403, error: "No puedes cambiar eso en este documento." };
    return rechazo(error, "guardar la edición");
  }
  if (!data) return { ok: false, status: 404, error: "El documento no existe." };
  return { ok: true, datos: aDocumento(data as unknown as Fila) };
}

// ---------------------------------------------------------------------------
// Ajustar con IA (CU-34 paso 3, RF-59, RF-77, RN-17, RN-28)
// ---------------------------------------------------------------------------

type Preparacion = {
  ajustes_usados: number;
  cobra: boolean;
  es_dueno: boolean;
  plantilla: string;
  modelo: string;
  precio_entrada_usd_mtok: number;
  precio_salida_usd_mtok: number;
};

export async function ajustarDocumento(
  usuarioId: string,
  rol: "empresa" | "consultor",
  id: string,
  cuerpo: Cuerpo
): Promise<Resultado<DocumentoServidor>> {
  if (!UUID.test(id)) return { ok: false, status: 404, error: "El documento no existe." };
  const indicacion = typeof cuerpo?.indicacion === "string" ? cuerpo.indicacion.trim() : "";
  if (indicacion.length < 3) return { ok: false, status: 400, error: "Escribe qué quieres ajustar." };
  if (indicacion.length > MAX_INDICACION) return { ok: false, status: 400, error: "La indicación es demasiado larga (máximo 1.000 caracteres)." };

  const servicio = crearClienteServicio();
  // Acceso (RN-27), suscripción y cupo de la empresa dueña, antes de llamar a la IA (RF-77).
  const { data: prep, error: ePrep } = await servicio
    .rpc("preparar_ajuste", { p_usuario: usuarioId, p_documento: id })
    .single<Preparacion>();
  if (ePrep) {
    if (rol === "consultor" && (ePrep.hint === "sin_creditos" || ePrep.hint === "sin_suscripcion")) {
      return {
        ok: false,
        status: 402,
        error: "La empresa dueña del documento no tiene créditos de IA disponibles. Avísale para que pueda seguir pidiendo ajustes.",
      };
    }
    return rechazo(ePrep, "preparar el ajuste");
  }

  const { data: fila } = await servicio.from("documentos_generados").select(COLUMNAS).eq("id", id).maybeSingle();
  if (!fila) return { ok: false, status: 404, error: "El documento no existe." };
  const doc = fila as unknown as Fila;

  const t0 = Date.now();
  const precioEntrada = Number(prep.precio_entrada_usd_mtok);
  const precioSalida = Number(prep.precio_salida_usd_mtok);
  try {
    const { proyecto, convocatoria, empresa } = await proyectoYConvocatoria(doc.proyecto_id, doc.convocatoria_id);
    if (!proyecto || !convocatoria) throw new Error("No se pudo leer el proyecto o la convocatoria");
    const r = await redactar({
      modelo: prep.modelo,
      instrucciones: prep.plantilla,
      mensaje: contextoAjuste({
        proyecto,
        empresa,
        convocatoria,
        titulo: doc.titulo ?? "",
        contenidoActual: doc.contenido ?? "",
        indicacion,
      }),
      maxTokensSalida: MAX_TOKENS_SALIDA,
      plazoMs: PLAZO_IA_MS,
    });

    const contenido = seccionesAContenido(r.secciones);
    const { error: eFin } = await servicio.rpc("completar_ajuste", {
      p_usuario: usuarioId,
      p_documento: id,
      p_ajustes_previos: prep.ajustes_usados,
      p_contenido: contenido,
      p_pendientes: pendientesDe(contenido),
      p_tokens_entrada: r.tokensEntrada,
      p_tokens_salida: r.tokensSalida,
      p_costo: costo(r.tokensEntrada, r.tokensSalida, precioEntrada, precioSalida),
      p_modelo: prep.modelo,
      p_duracion_ms: Date.now() - t0,
    });
    if (eFin) {
      await servicio.rpc("registrar_consumo_fallido", {
        p_usuario: usuarioId,
        p_documento: id,
        p_tipo: "ajuste",
        p_mensaje: `No se pudo guardar: ${eFin.hint ?? eFin.message}`,
        p_tokens_entrada: r.tokensEntrada,
        p_tokens_salida: r.tokensSalida,
        p_costo: costo(r.tokensEntrada, r.tokensSalida, precioEntrada, precioSalida),
        p_modelo: prep.modelo,
        p_duracion_ms: Date.now() - t0,
      });
      return rechazo(eFin, "guardar el ajuste");
    }
  } catch (e) {
    const f = mensajeFallo(e);
    console.error("IA: el ajuste falló", f.registro);
    await servicio.rpc("registrar_consumo_fallido", {
      p_usuario: usuarioId,
      p_documento: id,
      p_tipo: "ajuste",
      p_mensaje: f.registro,
      p_tokens_entrada: f.entrada,
      p_tokens_salida: f.salida,
      p_costo: costo(f.entrada, f.salida, precioEntrada, precioSalida),
      p_modelo: prep.modelo,
      p_duracion_ms: Date.now() - t0,
    });
    return { ok: false, status: f.status, error: f.error.replace("generar el documento", "aplicar el ajuste") };
  }

  return releerSinTraza(id);
}

/** Tras una escritura ya autorizada por la base: no cuenta como otra lectura. */
async function releerSinTraza(id: string): Promise<Resultado<DocumentoServidor>> {
  const { data } = await crearClienteServicio().from("documentos_generados").select(COLUMNAS).eq("id", id).maybeSingle();
  if (!data) return { ok: false, status: 404, error: "El documento no existe." };
  return { ok: true, datos: aDocumento((await completarNombres([data as unknown as Fila]))[0]) };
}

// ---------------------------------------------------------------------------
// Exportar (RF-60, RF-72): solo la empresa dueña
// ---------------------------------------------------------------------------

export async function documentoParaExportar(usuarioId: string, id: string): Promise<Resultado<DocumentoServidor>> {
  if (!UUID.test(id)) return { ok: false, status: 404, error: "El documento no existe." };
  const servicio = crearClienteServicio();
  const { error } = await servicio.rpc("marcar_exportado", { p_usuario: usuarioId, p_documento: id });
  if (error) return rechazo(error, "exportar");
  const { data } = await servicio.from("documentos_generados").select(COLUMNAS).eq("id", id).maybeSingle();
  if (!data) return { ok: false, status: 404, error: "El documento no existe." };
  return { ok: true, datos: aDocumento(data as unknown as Fila) };
}

/** La forma del store (`DocumentoGenerado`) para las pantallas que aún leen de él. */
export function aDocumentoStore(d: DocumentoServidor): DocumentoGenerado {
  return {
    id: d.id,
    usuarioId: d.usuarioId,
    proyectoId: d.proyectoId,
    convocatoriaId: d.convocatoriaId,
    titulo: d.titulo,
    version: d.version,
    estado: d.estado,
    promptVersionId: "",
    secciones: d.secciones,
    ajustesGratisUsados: d.ajustesUsados,
    // El día en Colombia, no en UTC (hallazgo de la sesión 027).
    fechaCreacion: fechaColombia(d.creadoAt),
    fechaActualizacion: fechaColombia(d.actualizadoAt),
    compartidoConConsultorId: d.compartidoConConsultorId,
    ultimaEdicionPor: d.ultimaEdicionPor,
  };
}

// ---------------------------------------------------------------------------
// Compartir con el consultor (RF-71)
// ---------------------------------------------------------------------------

const RECHAZOS_COMPARTIR: Record<string, { status: number; error: string }> = {
  sin_encargo_en_curso: {
    status: 409,
    error: "Solo puedes compartir el documento con el consultor de un encargo en curso sobre este proyecto.",
  },
};

export async function compartirDocumento(usuarioId: string, id: string, cuerpo: Cuerpo): Promise<Resultado<DocumentoServidor>> {
  if (!UUID.test(id)) return { ok: false, status: 404, error: "El documento no existe." };
  const consultorId = cuerpo?.consultorId;
  if (typeof consultorId !== "string" || !UUID.test(consultorId)) return { ok: false, status: 400, error: "Falta el consultor." };
  const { error } = await crearClienteServicio().rpc("compartir_documento", { p_usuario: usuarioId, p_documento: id, p_consultor: consultorId });
  if (error) {
    const conocido = error.hint ? RECHAZOS_COMPARTIR[error.hint] : undefined;
    return conocido ? { ok: false, ...conocido } : rechazo(error, "compartir");
  }
  return releer(id);
}

export async function revocarDocumento(usuarioId: string, id: string): Promise<Resultado<DocumentoServidor>> {
  if (!UUID.test(id)) return { ok: false, status: 404, error: "El documento no existe." };
  const { error } = await crearClienteServicio().rpc("revocar_documento", { p_usuario: usuarioId, p_documento: id });
  if (error) return rechazo(error, "revocar");
  return releer(id);
}

async function releer(id: string): Promise<Resultado<DocumentoServidor>> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("documentos_generados").select(COLUMNAS).eq("id", id).maybeSingle();
  if (!data) return { ok: false, status: 404, error: "El documento no existe." };
  return { ok: true, datos: aDocumento((await completarNombres([data as unknown as Fila]))[0]) };
}
