import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServicio } from "@/lib/supabase/servidor";
import { costo } from "@/lib/documentos-servidor";
import { ErrorIA, proveedorIA } from "@/lib/ia";
import { ESQUEMA_PROPUESTA, contextoEstructuracion, leerPropuesta } from "@/lib/ia/estructurar";
import {
  APARTADOS_IA,
  ESQUEMA_EDICION,
  INSTRUCCIONES_EDICION,
  MAX_INSTRUCCION,
  MAX_TEXTO_APARTADO,
  contextoEdicion,
  leerEdicion,
  type ApartadoIA,
} from "@/lib/ia/editar-apartado";
import { obtenerProyecto } from "@/lib/proyectos-servidor";
import type { Categoria, PropuestaProyecto } from "@/lib/types";

/**
 * Crear el proyecto con IA a partir de una explicación (CU-43 · docs/05 §9.29).
 *
 * - **Estructurar** (RF-96) cobra como la generación: `iniciar_estructuracion`
 *   reserva el crédito, `completar_estructuracion` lo cobra cuando la propuesta
 *   es válida y `fallar_estructuracion` libera sin cobro (RN-17). No guarda el
 *   proyecto: la empresa lo revisa y lo guarda por `POST /api/proyectos`.
 * - **Transcribir** (RF-97) no cobra: `iniciar_transcripcion` exige suscripción,
 *   crédito, una a la vez y el tope diario, y deja la fila del consumo creada
 *   antes de llamar a la IA; `registrar_transcripcion` la cierra.
 *
 * Las funciones de la base son de service_role y reciben el usuario de la
 * sesión ya verificada por el endpoint (RNF-20), como en §9.26.
 */

type Resultado<T> = { ok: true; datos: T } | { ok: false; status: number; error: string };

export const MIN_EXPLICACION = 80;
export const MAX_EXPLICACION = 8_000;
/** Vercel no acepta cuerpos de más de 4,5 MB; 5 minutos de voz comprimida ocupan ~1,5 MB. */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const PLAZO_ESTRUCTURACION_MS = 60_000;
const PLAZO_TRANSCRIPCION_MS = 60_000;
const MAX_TOKENS_SALIDA = 6_000;
const SIN_COBRO = " No se descontó ningún crédito. Puedes intentarlo de nuevo.";

const RECHAZOS: Record<string, { status: number; error: string }> = {
  no_es_empresa: { status: 403, error: "Solo una cuenta de empresa puede crear proyectos." },
  sin_suscripcion: { status: 402, error: "Necesitas una suscripción vigente para crear el proyecto con IA. Puedes llenar el formulario a mano." },
  sin_creditos: {
    status: 402,
    error: "No te quedan créditos de IA. Puedes llenar el formulario a mano o pedir un paquete adicional.",
  },
  sin_plantilla: { status: 503, error: "La IA no está disponible en este momento. Puedes llenar el formulario a mano." },
  estructuracion_no_encontrada: { status: 409, error: "La creación con IA se interrumpió. Intenta de nuevo." },
  transcripcion_en_curso: { status: 409, error: "Ya estamos transcribiendo un audio. Espera a que termine." },
  tope_transcripciones: { status: 429, error: "Llegaste al tope de dictados de hoy. Puedes seguir escribiendo la explicación." },
};

function rechazo(error: PostgrestError, accion: string): { ok: false; status: number; error: string } {
  const conocido = error.hint ? RECHAZOS[error.hint] : undefined;
  if (conocido) return { ok: false, ...conocido };
  console.error(`Proyectos con IA: ${accion} falló`, error.code, error.message);
  return { ok: false, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
}

// ---------------------------------------------------------------------------
// Estructurar (RF-96)
// ---------------------------------------------------------------------------

type Inicio = {
  reserva_id: string;
  /** La versión activa de la plantilla de creación de proyectos (RF-99). */
  instrucciones: string;
  modelo: string;
  precio_entrada_usd_mtok: number;
  precio_salida_usd_mtok: number;
};

export async function estructurarProyecto(
  usuarioId: string,
  cuerpo: Record<string, unknown> | null
): Promise<Resultado<PropuestaProyecto>> {
  const explicacion = typeof cuerpo?.explicacion === "string" ? cuerpo.explicacion.trim() : "";
  if (explicacion.length < MIN_EXPLICACION) {
    return {
      ok: false,
      status: 400,
      error: "Cuéntanos un poco más: qué hace el proyecto, para quién, dónde y cuánto necesitas (al menos 80 caracteres).",
    };
  }
  if (explicacion.length > MAX_EXPLICACION) {
    return { ok: false, status: 400, error: "La explicación es demasiado larga (máximo 8.000 caracteres)." };
  }

  const servicio = crearClienteServicio();
  const { data: cats, error: eCats } = await servicio.from("categorias").select("id, tipo, nombre").eq("activa", true).order("nombre");
  if (eCats) {
    console.error("Proyectos con IA: no se pudieron leer las categorías", eCats.code, eCats.message);
    return { ok: false, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
  }

  // Reserva el crédito y comprueba rol, suscripción y cupo (RNF-20, RN-17).
  const { data: inicio, error: eInicio } = await servicio
    .rpc("iniciar_estructuracion", { p_usuario: usuarioId })
    .single<Inicio>();
  if (eInicio) return rechazo(eInicio, "iniciar");

  const t0 = Date.now();
  const precioEntrada = Number(inicio.precio_entrada_usd_mtok);
  const precioSalida = Number(inicio.precio_salida_usd_mtok);
  let entrada: number | null = null;
  let salida: number | null = null;
  try {
    const { mensaje, claves } = contextoEstructuracion(explicacion, (cats ?? []) as Pick<Categoria, "id" | "tipo" | "nombre">[]);
    const r = await proveedorIA().estructurar({
      modelo: inicio.modelo,
      instrucciones: inicio.instrucciones,
      mensaje,
      esquema: ESQUEMA_PROPUESTA as unknown as Record<string, unknown>,
      maxTokensSalida: MAX_TOKENS_SALIDA,
      plazoMs: PLAZO_ESTRUCTURACION_MS,
    });
    entrada = r.tokensEntrada;
    salida = r.tokensSalida;
    const propuesta = leerPropuesta(r.json, claves);
    if (!propuesta) throw new ErrorIA("La respuesta del modelo no tiene la forma esperada", "respuesta_invalida", entrada, salida);

    const { error: eFin } = await servicio.rpc("completar_estructuracion", {
      p_reserva: inicio.reserva_id,
      p_tokens_entrada: entrada,
      p_tokens_salida: salida,
      p_costo: costo(entrada, salida, precioEntrada, precioSalida),
      p_modelo: inicio.modelo,
      p_duracion_ms: Date.now() - t0,
    });
    if (eFin) {
      await servicio.rpc("fallar_estructuracion", {
        p_reserva: inicio.reserva_id,
        p_mensaje: `No se pudo cobrar: ${eFin.hint ?? eFin.message}`,
        p_tokens_entrada: entrada,
        p_tokens_salida: salida,
        p_costo: costo(entrada, salida, precioEntrada, precioSalida),
        p_modelo: inicio.modelo,
        p_duracion_ms: Date.now() - t0,
      });
      return rechazo(eFin, "completar");
    }
    return { ok: true, datos: propuesta };
  } catch (e) {
    const ia = e instanceof ErrorIA ? e : null;
    console.error("Proyectos con IA: la estructuración falló", e instanceof Error ? e.message : String(e));
    await servicio.rpc("fallar_estructuracion", {
      p_reserva: inicio.reserva_id,
      p_mensaje: e instanceof Error ? e.message : String(e),
      p_tokens_entrada: ia?.tokensEntrada ?? entrada,
      p_tokens_salida: ia?.tokensSalida ?? salida,
      p_costo: costo(ia?.tokensEntrada ?? entrada, ia?.tokensSalida ?? salida, precioEntrada, precioSalida),
      p_modelo: inicio.modelo,
      p_duracion_ms: Date.now() - t0,
    });
    if (ia?.motivo === "plazo") return { ok: false, status: 504, error: `La IA tardó demasiado en responder.${SIN_COBRO}` };
    if (ia?.motivo === "configuracion") return { ok: false, status: 503, error: `La IA no está disponible en este momento.${SIN_COBRO}` };
    return { ok: false, status: 502, error: `No pudimos armar el proyecto con IA.${SIN_COBRO}` };
  }
}

// ---------------------------------------------------------------------------
// Transcribir (RF-97)
// ---------------------------------------------------------------------------

const TIPOS_AUDIO = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|m4a|x-m4a|aac)(;.*)?$/;

export async function transcribirAudio(usuarioId: string, formulario: FormData | null): Promise<Resultado<{ texto: string }>> {
  const audio = formulario?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return { ok: false, status: 400, error: "No recibimos el audio. Intenta grabar de nuevo." };
  if (audio.size > MAX_AUDIO_BYTES) return { ok: false, status: 413, error: "El audio es demasiado largo. Graba hasta 5 minutos." };
  if (!TIPOS_AUDIO.test(audio.type)) return { ok: false, status: 415, error: "Ese formato de audio no se admite." };
  // Solo para estimar el costo (RF-52) cuando el proveedor no informa la duración.
  const segundosCliente = Math.min(Math.max(Number(formulario?.get("segundos")) || 0, 0), 300);

  const servicio = crearClienteServicio();
  const { data: inicio, error: eInicio } = await servicio
    .rpc("iniciar_transcripcion", { p_usuario: usuarioId })
    .single<{ consumo_id: string; modelo: string; precio_usd_min: number }>();
  if (eInicio) return rechazo(eInicio, "iniciar la transcripción");

  const t0 = Date.now();
  const extension = audio.type.includes("mp4") || audio.type.includes("m4a") ? "m4a" : audio.type.includes("ogg") ? "ogg" : audio.type.includes("wav") ? "wav" : audio.type.includes("mpeg") || audio.type.includes("mp3") ? "mp3" : "webm";
  try {
    const r = await proveedorIA().transcribir({
      modelo: inicio.modelo,
      audio,
      nombreArchivo: `dictado.${extension}`,
      plazoMs: PLAZO_TRANSCRIPCION_MS,
    });
    const segundos = r.segundos ?? segundosCliente;
    await servicio.rpc("registrar_transcripcion", {
      p_consumo: inicio.consumo_id,
      p_exito: true,
      p_mensaje: null,
      p_costo: Number(((segundos / 60) * Number(inicio.precio_usd_min)).toFixed(6)),
      p_duracion_ms: Date.now() - t0,
    });
    if (!r.texto) return { ok: false, status: 422, error: "No logramos entender el audio. Intenta hablar más cerca del micrófono." };
    return { ok: true, datos: { texto: r.texto.slice(0, MAX_EXPLICACION) } };
  } catch (e) {
    console.error("Proyectos con IA: la transcripción falló", e instanceof Error ? e.message : String(e));
    await servicio.rpc("registrar_transcripcion", {
      p_consumo: inicio.consumo_id,
      p_exito: false,
      p_mensaje: e instanceof Error ? e.message : String(e),
      p_costo: null,
      p_duracion_ms: Date.now() - t0,
    });
    const plazo = e instanceof ErrorIA && e.motivo === "plazo";
    return {
      ok: false,
      status: plazo ? 504 : 502,
      error: "No pudimos transcribir el audio. Lo que ya escribiste sigue ahí; puedes intentarlo de nuevo o escribir.",
    };
  }
}

// ---------------------------------------------------------------------------
// Editar un apartado (RF-109, CU-47 · docs/05 §9.35)
// ---------------------------------------------------------------------------

type InicioEdicion = {
  reserva_id: string;
  modelo: string;
  precio_entrada_usd_mtok: number;
  precio_salida_usd_mtok: number;
};

const PLAZO_EDICION_MS = 45_000;
const MAX_TOKENS_EDICION = 2_500;

const RECHAZOS_EDICION: Record<string, { status: number; error: string }> = {
  ...RECHAZOS,
  no_existe: { status: 404, error: "El proyecto no existe." },
  sin_suscripcion: { status: 402, error: "Necesitas una suscripción vigente para editar con IA. Puedes editarlo a mano." },
  sin_creditos: { status: 402, error: "No te quedan créditos de IA. Puedes editar el apartado a mano o pedir un paquete adicional." },
  edicion_no_encontrada: { status: 409, error: "La edición con IA se interrumpió. Intenta de nuevo." },
};

function rechazoEdicion(error: PostgrestError, accion: string): { ok: false; status: number; error: string } {
  const conocido = error.hint ? RECHAZOS_EDICION[error.hint] : undefined;
  if (conocido) return { ok: false, ...conocido };
  console.error(`Editar apartado con IA: ${accion} falló`, error.code, error.message);
  return { ok: false, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
}

/**
 * La IA propone el texto nuevo de un apartado; **no guarda nada**: la empresa
 * lo acepta y guarda por `PATCH /api/proyectos/[id]` (RN-37). La tarifa se
 * cobra solo si la propuesta llega válida (RN-17).
 */
export async function editarApartadoConIA(
  usuarioId: string,
  proyectoId: string,
  cuerpo: Record<string, unknown> | null
): Promise<Resultado<{ texto: string; faltantes: string[] }>> {
  const apartado = cuerpo?.apartado as ApartadoIA;
  if (typeof apartado !== "string" || !(apartado in APARTADOS_IA)) {
    return { ok: false, status: 400, error: "Ese apartado no se puede editar con IA." };
  }
  const instruccion = typeof cuerpo?.instruccion === "string" ? cuerpo.instruccion.trim() : "";
  if (instruccion.length < 5) return { ok: false, status: 400, error: "Cuéntale a la IA qué quieres cambiar." };
  if (instruccion.length > MAX_INSTRUCCION) {
    return { ok: false, status: 400, error: "La petición es demasiado larga (máximo 2.000 caracteres)." };
  }
  const textoActual = typeof cuerpo?.textoActual === "string" ? cuerpo.textoActual : "";
  if (textoActual.length > MAX_TEXTO_APARTADO) return { ok: false, status: 400, error: "El texto del apartado es demasiado largo." };

  // El proyecto se lee con la sesión de la empresa (RN-30); la base lo vuelve a comprobar al reservar.
  const proyecto = await obtenerProyecto(proyectoId);
  if (!proyecto) return { ok: false, status: 404, error: "El proyecto no existe." };

  const servicio = crearClienteServicio();
  const { data: inicio, error: eInicio } = await servicio
    .rpc("iniciar_edicion_apartado", { p_usuario: usuarioId, p_proyecto: proyectoId })
    .single<InicioEdicion>();
  if (eInicio) return rechazoEdicion(eInicio, "iniciar");

  const t0 = Date.now();
  const precioEntrada = Number(inicio.precio_entrada_usd_mtok);
  const precioSalida = Number(inicio.precio_salida_usd_mtok);
  let entrada: number | null = null;
  let salida: number | null = null;
  const fallar = (mensaje: string, ent: number | null, sal: number | null) =>
    servicio.rpc("fallar_edicion_apartado", {
      p_reserva: inicio.reserva_id,
      p_mensaje: mensaje,
      p_tokens_entrada: ent,
      p_tokens_salida: sal,
      p_costo: costo(ent, sal, precioEntrada, precioSalida),
      p_modelo: inicio.modelo,
      p_duracion_ms: Date.now() - t0,
    });
  try {
    const datos = Object.fromEntries(
      (Object.keys(APARTADOS_IA) as ApartadoIA[]).map((k) => {
        const v = proyecto[k];
        return [k, Array.isArray(v) ? v.join("\n") : (v ?? "")];
      })
    ) as Record<ApartadoIA, string>;
    const r = await proveedorIA().estructurar({
      modelo: inicio.modelo,
      instrucciones: INSTRUCCIONES_EDICION,
      mensaje: contextoEdicion(apartado, textoActual, instruccion, datos),
      esquema: ESQUEMA_EDICION as unknown as Record<string, unknown>,
      maxTokensSalida: MAX_TOKENS_EDICION,
      plazoMs: PLAZO_EDICION_MS,
    });
    entrada = r.tokensEntrada;
    salida = r.tokensSalida;
    const propuesta = leerEdicion(r.json, apartado);
    if (!propuesta) throw new ErrorIA("La respuesta del modelo no tiene la forma esperada", "respuesta_invalida", entrada, salida);

    const { error: eFin } = await servicio.rpc("completar_edicion_apartado", {
      p_reserva: inicio.reserva_id,
      p_tokens_entrada: entrada,
      p_tokens_salida: salida,
      p_costo: costo(entrada, salida, precioEntrada, precioSalida),
      p_modelo: inicio.modelo,
      p_duracion_ms: Date.now() - t0,
    });
    if (eFin) {
      await fallar(`No se pudo cobrar: ${eFin.hint ?? eFin.message}`, entrada, salida);
      return rechazoEdicion(eFin, "completar");
    }
    return { ok: true, datos: propuesta };
  } catch (e) {
    const ia = e instanceof ErrorIA ? e : null;
    console.error("Editar apartado con IA: falló", e instanceof Error ? e.message : String(e));
    await fallar(e instanceof Error ? e.message : String(e), ia?.tokensEntrada ?? entrada, ia?.tokensSalida ?? salida);
    if (ia?.motivo === "plazo") return { ok: false, status: 504, error: `La IA tardó demasiado en responder.${SIN_COBRO}` };
    if (ia?.motivo === "configuracion") return { ok: false, status: 503, error: `La IA no está disponible en este momento.${SIN_COBRO}` };
    return { ok: false, status: 502, error: `No pudimos editar el apartado con IA.${SIN_COBRO}` };
  }
}
