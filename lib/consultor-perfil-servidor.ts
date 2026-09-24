import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { firmarDescarga } from "@/lib/supabase/descarga";
import type {
  EstadoPerfilConsultor,
  PerfilConsultorPropio,
  RedSocialTipo,
} from "@/lib/types";

/**
 * Perfil del consultor, visto y editado por su dueño (RF-22..25, RF-88,
 * CU-15..17 · docs/05 §9.20 · Sprint 4 paso 1a). Todo con la sesión del
 * consultor: la RLS decide qué fila es suya y las funciones de la base hacen
 * cumplir los mínimos. Aquí se valida la forma antes de tocar la base.
 */

type Resultado<T> = { ok: true; datos: T } | { ok: false; status: number; error: string };
type Cuerpo = Record<string, unknown> | null;
const invalido = (error: string) => ({ ok: false as const, status: 400, error });

export const BUCKET_FOTO = "fotos-consultores";
export const BUCKET_CV = "hojas-de-vida";

// El bucket repite estos límites, así que una subida directa tampoco pasa (docs/05 §9.14).
const ARCHIVOS = {
  foto: {
    bucket: BUCKET_FOTO,
    maximo: 5 * 1024 * 1024,
    formatos: { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" } as Record<string, string>,
    prefijo: "foto",
    columna: "foto_path",
    nombre: "La foto",
  },
  cv: {
    bucket: BUCKET_CV,
    maximo: 10 * 1024 * 1024,
    formatos: { pdf: "application/pdf" } as Record<string, string>,
    prefijo: "hoja-de-vida",
    columna: "cv_path",
    nombre: "La hoja de vida",
  },
} as const;

export type TipoArchivo = keyof typeof ARCHIVOS;
export const esTipoArchivo = (v: unknown): v is TipoArchivo => v === "foto" || v === "cv";

const TIPOS_RED: RedSocialTipo[] = ["linkedin", "instagram", "facebook", "otra"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// La misma forma que exigen los check de la base.
const URL_WEB = /^https?:\/\/[^\s/]+\.[^\s]+$/i;

// Rechazos de la base por su clave estable (hint).
const RECHAZOS: Record<string, { status: number; error: string }> = {
  no_es_consultor: { status: 403, error: "Solo un consultor edita su perfil." },
  sin_consentimiento: {
    status: 409,
    error: "Acepta la autorización de tratamiento de datos para poder guardar tu perfil.",
  },
  nombre_vacio: { status: 400, error: "Escribe tu nombre profesional." },
  categoria_invalida: { status: 400, error: "Alguna especialidad ya no está disponible. Recarga la página." },
  estado_no_permite: { status: 409, error: "Tu perfil ya fue enviado a revisión." },
};

function traducir(error: PostgrestError, contexto: string): { ok: false; status: number; error: string } {
  if (error.hint === "minimos_incompletos") return { ok: false, status: 409, error: error.message };
  const conocido = error.hint ? RECHAZOS[error.hint] : undefined;
  if (conocido) return { ok: false, ...conocido };
  if (error.code === "23514") return invalido("Revisa los enlaces: deben empezar por https:// y ser una dirección web válida.");
  console.error(`Perfil de consultor: ${contexto}`, error.code, error.message);
  return { ok: false, status: 500, error: "No pudimos guardar los cambios. Intenta de nuevo." };
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export async function obtenerPerfilPropio(usuarioId: string): Promise<PerfilConsultorPropio | null> {
  const supabase = await crearClienteServidor();
  const [perfil, cuenta, contacto, especialidades, redes, portafolio] = await Promise.all([
    supabase
      .from("consultor_perfiles")
      .select("id, nombre_profesional, descripcion, foto_path, estado_perfil, motivo_rechazo")
      .eq("id", usuarioId)
      .maybeSingle(),
    supabase.from("perfiles").select("consentimiento_datos_at").eq("id", usuarioId).maybeSingle(),
    // sitio_web y cv_path no se leen de la tabla: los da esta función (docs/05 §9.11 punto 4).
    supabase.rpc("contacto_consultor", { p_consultor: usuarioId }).maybeSingle(),
    supabase.from("consultor_especialidades").select("categoria_id").eq("consultor_id", usuarioId),
    supabase.from("consultor_redes").select("tipo, url").eq("consultor_id", usuarioId),
    supabase
      .from("consultor_portafolio")
      .select("nombre_proyecto, entidad, anio, descripcion, resultado")
      .eq("consultor_id", usuarioId)
      .order("orden"),
  ]);
  for (const r of [perfil, cuenta, contacto, especialidades, redes, portafolio]) {
    if (r.error) console.error("Perfil de consultor: no se pudo leer", r.error.code, r.error.message);
  }
  if (!perfil.data) return null;

  const c = contacto.data as { sitio_web: string | null; cv_path: string | null } | null;
  let fotoUrl: string | null = null;
  if (perfil.data.foto_path) {
    const { data } = await supabase.storage.from(BUCKET_FOTO).createSignedUrl(perfil.data.foto_path, 900);
    fotoUrl = data?.signedUrl ?? null;
  }

  return {
    id: perfil.data.id,
    nombreProfesional: perfil.data.nombre_profesional ?? "",
    descripcion: perfil.data.descripcion ?? "",
    sitioWeb: c?.sitio_web ?? "",
    especialidades: (especialidades.data ?? []).map((e) => e.categoria_id),
    redes: (redes.data ?? []).map((r) => ({ tipo: r.tipo as RedSocialTipo, url: r.url })),
    portafolio: (portafolio.data ?? []).map((p) => ({
      nombreProyecto: p.nombre_proyecto,
      entidad: p.entidad ?? "",
      anio: p.anio,
      descripcion: p.descripcion ?? "",
      resultado: p.resultado ?? "",
    })),
    fotoUrl,
    tieneHojaDeVida: Boolean(c?.cv_path),
    estadoPerfil: perfil.data.estado_perfil as EstadoPerfilConsultor,
    motivoRechazo: perfil.data.motivo_rechazo,
    consentimientoDatos: Boolean(cuenta.data?.consentimiento_datos_at),
  };
}

// ---------------------------------------------------------------------------
// Guardar (RF-23, CU-16)
// ---------------------------------------------------------------------------

function texto(valor: unknown, maximo: number, etiqueta: string): string | { error: string } {
  if (valor === undefined || valor === null) return "";
  if (typeof valor !== "string") return { error: `${etiqueta} no es válido.` };
  const limpio = valor.trim();
  if (limpio.length > maximo) return { error: `${etiqueta} admite hasta ${maximo} caracteres.` };
  return limpio;
}

function datosDelPerfil(cuerpo: Cuerpo):
  | { ok: true; datos: Record<string, string>; especialidades: string[]; redes: { tipo: string; url: string }[]; portafolio: Record<string, unknown>[] }
  | ReturnType<typeof invalido> {
  const nombre = texto(cuerpo?.nombreProfesional, 120, "El nombre profesional");
  const descripcion = texto(cuerpo?.descripcion, 2000, "La descripción");
  const sitioWeb = texto(cuerpo?.sitioWeb, 300, "El sitio web");
  for (const v of [nombre, descripcion, sitioWeb]) if (typeof v !== "string") return invalido(v.error);
  if (!nombre) return invalido("Escribe tu nombre profesional.");
  if (sitioWeb && !URL_WEB.test(sitioWeb as string)) {
    return invalido("El sitio web debe ser una dirección completa, por ejemplo https://miempresa.co");
  }

  const especialidades = cuerpo?.especialidades ?? [];
  if (!Array.isArray(especialidades) || especialidades.length > 30 || !especialidades.every((e) => typeof e === "string" && UUID.test(e))) {
    return invalido("Las especialidades no son válidas.");
  }

  const redesCrudas = cuerpo?.redes ?? [];
  if (!Array.isArray(redesCrudas) || redesCrudas.length > 10) return invalido("Puedes agregar hasta 10 redes.");
  const redes: { tipo: string; url: string }[] = [];
  for (const r of redesCrudas as Record<string, unknown>[]) {
    const url = typeof r?.url === "string" ? r.url.trim() : "";
    if (!url) continue; // una fila vacía en la pantalla no es una red
    if (!TIPOS_RED.includes(r.tipo as RedSocialTipo)) return invalido("Tipo de red no válido.");
    if (url.length > 300 || !URL_WEB.test(url)) {
      return invalido(`El enlace "${url.slice(0, 60)}" no es válido: debe empezar por https://`);
    }
    redes.push({ tipo: r.tipo as string, url });
  }

  const portafolioCrudo = cuerpo?.portafolio ?? [];
  if (!Array.isArray(portafolioCrudo) || portafolioCrudo.length > 30) {
    return invalido("El portafolio admite hasta 30 proyectos.");
  }
  const anioMaximo = new Date().getFullYear() + 1;
  const portafolio: Record<string, unknown>[] = [];
  for (const [i, p] of (portafolioCrudo as Record<string, unknown>[]).entries()) {
    const n = i + 1;
    const campos = {
      nombre_proyecto: texto(p?.nombreProyecto, 200, `El nombre del proyecto ${n}`),
      entidad: texto(p?.entidad, 200, `La entidad del proyecto ${n}`),
      descripcion: texto(p?.descripcion, 1000, `La descripción del proyecto ${n}`),
      resultado: texto(p?.resultado, 500, `El resultado del proyecto ${n}`),
    };
    for (const v of Object.values(campos)) if (typeof v !== "string") return invalido(v.error);
    if (!campos.nombre_proyecto) return invalido(`Escribe el nombre del proyecto ${n} del portafolio o quítalo.`);
    let anio: number | null = null;
    if (p?.anio !== undefined && p?.anio !== null && p?.anio !== "") {
      anio = Number(p.anio);
      if (!Number.isInteger(anio) || anio < 1950 || anio > anioMaximo) {
        return invalido(`El año del proyecto ${n} debe estar entre 1950 y ${anioMaximo}.`);
      }
    }
    portafolio.push({ ...campos, anio });
  }

  return {
    ok: true,
    datos: { nombre_profesional: nombre as string, descripcion: descripcion as string, sitio_web: sitioWeb as string },
    especialidades: [...new Set(especialidades as string[])],
    redes,
    portafolio,
  };
}

export async function guardarPerfil(usuarioId: string, cuerpo: Cuerpo): Promise<Resultado<PerfilConsultorPropio>> {
  const v = datosDelPerfil(cuerpo);
  if (!v.ok) return v;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("guardar_perfil_consultor", {
    p_datos: v.datos,
    p_especialidades: v.especialidades,
    p_redes: v.redes,
    p_portafolio: v.portafolio,
  });
  if (error) return traducir(error, "no se pudo guardar");
  const perfil = await obtenerPerfilPropio(usuarioId);
  return perfil ? { ok: true, datos: perfil } : { ok: false, status: 500, error: "No pudimos releer tu perfil." };
}

/** RF-88 · Para la cuenta creada antes de que el registro pidiera la casilla. */
export async function aceptarConsentimiento(): Promise<Resultado<null>> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("aceptar_consentimiento_datos");
  if (error) return traducir(error, "no se pudo registrar el consentimiento");
  return { ok: true, datos: null };
}

// ---------------------------------------------------------------------------
// Archivos: foto y hoja de vida (RF-23, RNF-16, docs/05 §9.20)
// ---------------------------------------------------------------------------

function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  return punto === -1 ? "" : nombre.slice(punto + 1).toLowerCase();
}

/** Paso 1 · Valida y firma la subida. La ruta la decide el servidor. */
export async function urlDeSubida(usuarioId: string, cuerpo: Cuerpo): Promise<Resultado<{ ruta: string; token: string }>> {
  if (!esTipoArchivo(cuerpo?.tipo)) return invalido("Tipo de archivo no válido.");
  const cfg = ARCHIVOS[cuerpo.tipo];
  const extension = extensionDe(typeof cuerpo.nombreArchivo === "string" ? cuerpo.nombreArchivo : "");
  if (!cfg.formatos[extension]) {
    return invalido(cuerpo.tipo === "foto" ? "La foto debe ser JPG o PNG." : "La hoja de vida debe ser un PDF.");
  }
  const tamano = Number(cuerpo.tamanoBytes);
  if (!Number.isFinite(tamano) || tamano <= 0) return invalido("No pudimos leer el tamaño del archivo.");
  if (tamano > cfg.maximo) return invalido(`${cfg.nombre} supera los ${cfg.maximo / 1024 / 1024} MB permitidos.`);

  const ruta = `${usuarioId}/${cfg.prefijo}-${crypto.randomUUID()}.${extension === "jpeg" ? "jpg" : extension}`;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from(cfg.bucket).createSignedUploadUrl(ruta);
  if (error || !data) {
    console.error("Perfil de consultor: no se pudo firmar la subida", error?.message);
    return { ok: false, status: 500, error: "No pudimos preparar la subida. Intenta de nuevo." };
  }
  return { ok: true, datos: { ruta, token: data.token } };
}

/**
 * Paso 3 · Registra el archivo solo si existe de verdad en el bucket, con el
 * tamaño y el tipo que reporta Storage, y borra el anterior.
 */
export async function registrarArchivo(usuarioId: string, cuerpo: Cuerpo): Promise<Resultado<PerfilConsultorPropio>> {
  if (!esTipoArchivo(cuerpo?.tipo)) return invalido("Tipo de archivo no válido.");
  const tipo = cuerpo.tipo;
  const cfg = ARCHIVOS[tipo];
  const ruta = typeof cuerpo.ruta === "string" ? cuerpo.ruta : "";
  const forma = new RegExp(`^${usuarioId}/${cfg.prefijo}-[0-9a-f-]{36}\\.(${Object.keys(cfg.formatos).join("|")})$`);
  if (!forma.test(ruta)) return invalido("Ruta de archivo no válida.");

  const supabase = await crearClienteServidor();
  const nombre = ruta.slice(usuarioId.length + 1);
  const { data: objetos, error: eLista } = await supabase.storage.from(cfg.bucket).list(usuarioId, { search: nombre, limit: 1 });
  if (eLista) {
    console.error("Perfil de consultor: no se pudo consultar el bucket", eLista.message);
    return { ok: false, status: 500, error: "No pudimos confirmar la subida. Intenta de nuevo." };
  }
  const objeto = objetos?.find((o) => o.name === nombre);
  if (!objeto) return invalido("El archivo no llegó a subirse. Inténtalo otra vez.");

  const meta = (objeto.metadata ?? {}) as { size?: number; mimetype?: string };
  if (Number(meta.size ?? 0) > cfg.maximo || meta.mimetype !== cfg.formatos[extensionDe(ruta)]) {
    await supabase.storage.from(cfg.bucket).remove([ruta]);
    return invalido(`${cfg.nombre} no tiene el formato o el tamaño permitido.`);
  }

  const { data: anterior } =
    tipo === "foto"
      ? await supabase.from("consultor_perfiles").select("foto_path").eq("id", usuarioId).maybeSingle()
      : await supabase.rpc("contacto_consultor", { p_consultor: usuarioId }).maybeSingle();
  const rutaAnterior = (anterior as Record<string, string | null> | null)?.[cfg.columna] ?? null;

  const { error } = await supabase.from("consultor_perfiles").update({ [cfg.columna]: ruta }).eq("id", usuarioId);
  if (error) {
    await supabase.storage.from(cfg.bucket).remove([ruta]);
    return traducir(error, "no se pudo registrar el archivo");
  }
  if (rutaAnterior && rutaAnterior !== ruta) {
    const { error: eBorrar } = await supabase.storage.from(cfg.bucket).remove([rutaAnterior]);
    if (eBorrar) console.error("Perfil de consultor: quedó un archivo anterior sin borrar", rutaAnterior, eBorrar.message);
  }

  const perfil = await obtenerPerfilPropio(usuarioId);
  return perfil ? { ok: true, datos: perfil } : { ok: false, status: 500, error: "No pudimos releer tu perfil." };
}

/** RNF-16 · URL firmada de 15 minutos para que el consultor vea su archivo. */
export async function enlaceDeArchivo(usuarioId: string, tipo: string): Promise<Resultado<{ url: string }>> {
  if (!esTipoArchivo(tipo)) return { ok: false, status: 404, error: "El archivo no existe." };
  const cfg = ARCHIVOS[tipo];
  const supabase = await crearClienteServidor();
  const { data } =
    tipo === "foto"
      ? await supabase.from("consultor_perfiles").select("foto_path").eq("id", usuarioId).maybeSingle()
      : await supabase.rpc("contacto_consultor", { p_consultor: usuarioId }).maybeSingle();
  const ruta = (data as Record<string, string | null> | null)?.[cfg.columna];
  if (!ruta) return { ok: false, status: 404, error: "Todavía no has subido ese archivo." };
  const firmado = await firmarDescarga(supabase, cfg.bucket, ruta, tipo === "cv" ? "Hoja de vida.pdf" : `Foto.${extensionDe(ruta)}`);
  if ("error" in firmado) {
    console.error("Perfil de consultor: no se pudo firmar la descarga", firmado.error);
    return { ok: false, status: 500, error: "No pudimos preparar la descarga." };
  }
  return { ok: true, datos: { url: firmado.url } };
}

// ---------------------------------------------------------------------------
// Enviar a revisión (RF-24, RF-25, CU-17)
// ---------------------------------------------------------------------------

export async function enviarARevision(usuarioId: string): Promise<Resultado<PerfilConsultorPropio>> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("enviar_perfil_a_revision");
  if (error) return traducir(error, "no se pudo enviar a revisión");
  const perfil = await obtenerPerfilPropio(usuarioId);
  return perfil ? { ok: true, datos: perfil } : { ok: false, status: 500, error: "No pudimos releer tu perfil." };
}

