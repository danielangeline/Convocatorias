import "server-only";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { refrescarIndicadores } from "@/lib/catalogo";
import { hoyColombia } from "@/lib/fechas";
import { DEPARTAMENTOS } from "@/lib/departamentos";
import type { TipoConvocatoria, OrigenConvocatoria, TipoRequisito } from "@/lib/types";
import { rechazo, validarFicha, type FichaValidada } from "./catalogo";
import { EXTENSIONES, TAMANO_MAXIMO, extensionDe } from "./documentos";
import {
  COLUMNAS_CARGA,
  MARCA_OPCIONAL,
  leerCsv,
  leerDocumentos,
  leerFecha,
  lista,
  normalizar,
  type ArchivoElegido,
  type DocumentoCarga,
  type FilaCarga,
  type ResultadoCarga,
} from "./carga-masiva";
import type { Resultado } from "./administradores";

/**
 * CU-50, RF-118 · Carga masiva de convocatorias. Quien llama ya comprobó la
 * sesión de administrador con aal2 (`conAdministrador`); todo se lee y escribe
 * con esa sesión, así que la RLS es otra barrera.
 *
 * Cada fila se traduce al mismo cuerpo que envía el editor y pasa por
 * `validarFicha`, así que la carga no tiene reglas propias sobre la ficha: solo
 * traduce nombres a identificadores (fuente, categorías, países, departamentos).
 * Todo se resuelve antes de escribir, porque una convocatoria no se borra
 * (RN-07): una fila que falla no deja un borrador a medias. Nunca publica.
 *
 * Los documentos (sesión 035) no pasan por aquí: la pantalla manda solo el
 * nombre y el tamaño de cada archivo elegido; aquí se cruzan con la columna
 * `documentos` y, ya creado el borrador, el navegador sube cada uno por el
 * camino de RF-07, que vuelve a validar todo (`lib/admin/documentos.ts`).
 */

type Cuerpo = Record<string, unknown> | null;

const EJEMPLO = normalizar(COLUMNAS_CARGA.find((c) => c.clave === "nombre")!.ejemplo);
const SI = new Set(["si", "s", "x", "true", "verdadero", "1"]);
const NO = new Set(["", "no", "n", "false", "falso", "0"]);
const TIPOS: Record<string, TipoConvocatoria> = {
  fondo: "fondo",
  beneficio_tributario: "beneficio_tributario",
  "beneficio tributario": "beneficio_tributario",
};
const ORIGENES: Record<string, OrigenConvocatoria> = { publico: "publico", privado: "privado", cooperacion: "cooperacion" };

/** Nombres de departamento comparables: sin tildes, sin puntos («Bogotá D.C.» = «bogota dc» = «bogota»). */
const sinPuntos = (v: string) => normalizar(v).replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
const DEPTOS = new Map<string, string>();
for (const d of DEPARTAMENTOS) {
  DEPTOS.set(d.codigo, d.codigo);
  DEPTOS.set(sinPuntos(d.nombre), d.codigo);
}
DEPTOS.set("bogota", "11");
DEPTOS.set("san andres", "88");

type Listas = {
  fuentes: Map<string, string>;
  categorias: Map<string, string[]>;
  paises: Map<string, string>;
  monedas: Set<string>;
  existentes: Set<string>;
};

const claveDuplicado = (nombre: string, entidad: string) => `${normalizar(nombre)}\u0000${normalizar(entidad)}`;

async function leerListas(): Promise<Listas> {
  const supabase = await crearClienteServidor();
  const [fuentes, categorias, paises, monedas, convocatorias] = await Promise.all([
    supabase.from("fuentes").select("id, nombre").eq("activa", true),
    supabase.from("categorias").select("id, nombre").eq("activa", true),
    supabase.from("paises").select("codigo, nombre"),
    supabase.from("monedas").select("codigo"),
    supabase.from("convocatorias").select("nombre, entidad_convocante").limit(10000),
  ]);
  for (const r of [fuentes, categorias, paises, monedas, convocatorias]) {
    if (r.error) throw new Error(`Carga masiva: no se pudieron leer las listas: ${r.error.message}`);
  }

  const porCategoria = new Map<string, string[]>();
  for (const c of categorias.data ?? []) {
    const clave = normalizar(c.nombre);
    porCategoria.set(clave, [...(porCategoria.get(clave) ?? []), c.id]);
  }
  const porPais = new Map<string, string>();
  for (const p of paises.data ?? []) {
    porPais.set(p.codigo, p.codigo);
    porPais.set(normalizar(p.nombre), p.codigo);
  }
  return {
    fuentes: new Map((fuentes.data ?? []).map((f) => [normalizar(f.nombre), f.id])),
    categorias: porCategoria,
    paises: porPais,
    monedas: new Set((monedas.data ?? []).map((m) => m.codigo)),
    existentes: new Set((convocatorias.data ?? []).map((c) => claveDuplicado(c.nombre, c.entidad_convocante))),
  };
}

/** Requisitos de una celda; `[opcional]` al principio los deja como no obligatorios. */
function requisitos(valor: string | undefined, tipo: TipoRequisito) {
  return lista(valor).map((texto) => {
    const opcional = normalizar(texto).startsWith(MARCA_OPCIONAL);
    return { tipo, descripcion: opcional ? texto.slice(MARCA_OPCIONAL.length).trim() : texto, obligatorio: !opcional };
  });
}

/**
 * Traduce una fila al cuerpo del editor y la valida. Reúne todos los errores
 * de traducción de la fila; si no hay, `validarFicha` añade el primero que
 * encuentre entre filas (p. ej. apertura después del cierre).
 */
function traducirFila(
  c: Record<string, string>,
  listas: Listas,
  hoy: string,
  archivos: Map<string, ArchivoElegido>
): { ficha: FichaValidada; fuenteId: string; documentos: DocumentoCarga[] } | { errores: string[] } {
  const errores: string[] = [];

  const fuenteId = listas.fuentes.get(normalizar(c.fuente ?? ""));
  if (!c.fuente) errores.push("fuente: falta.");
  else if (!fuenteId) errores.push(`fuente: «${c.fuente}» no existe o está inactiva.`);

  if (!c.nombre) errores.push("nombre: falta.");
  else if (normalizar(c.nombre) === EJEMPLO) errores.push("nombre: es la fila de ejemplo de la plantilla; bórrala.");
  if (!c.entidad_convocante) errores.push("entidad_convocante: falta.");

  const tipo = c.tipo ? TIPOS[normalizar(c.tipo)] : undefined;
  if (c.tipo && !tipo) errores.push(`tipo: «${c.tipo}» no es fondo ni beneficio_tributario.`);
  const origen = c.origen ? ORIGENES[normalizar(c.origen)] : undefined;
  if (c.origen && !origen) errores.push(`origen: «${c.origen}» no es publico, privado ni cooperacion.`);

  const moneda = (c.moneda || "COP").toUpperCase();
  if (!listas.monedas.has(moneda)) errores.push(`moneda: «${c.moneda}» no es un código ISO 4217 de la lista.`);

  // RN-39 · TODOS o una lista; vacía, la convocatoria queda sin países y no se podrá publicar hasta declararlos.
  const todosLosPaises = normalizar(c.paises ?? "") === "todos";
  const paises: string[] = [];
  if (!todosLosPaises) {
    for (const p of lista(c.paises)) {
      const codigo = listas.paises.get(p.length === 2 ? p.toUpperCase() : normalizar(p));
      if (codigo) paises.push(codigo);
      else errores.push(`paises: «${p}» no es un país de la lista (usa el código ISO de 2 letras o el nombre).`);
    }
  }

  const nacional = normalizar(c.cobertura_nacional ?? "");
  if (!SI.has(nacional) && !NO.has(nacional)) errores.push(`cobertura_nacional: «${c.cobertura_nacional}» debe ser si o no.`);
  const departamentos: string[] = [];
  for (const d of lista(c.departamentos)) {
    const codigo = DEPTOS.get(/^\d{1,2}$/.test(d) ? d.padStart(2, "0") : sinPuntos(d));
    if (codigo) departamentos.push(codigo);
    else errores.push(`departamentos: «${d}» no es un departamento de Colombia.`);
  }

  const cierre = c.fecha_cierre ? leerFecha(c.fecha_cierre) : null;
  if (!c.fecha_cierre) errores.push("fecha_cierre: falta.");
  else if (!cierre) errores.push(`fecha_cierre: «${c.fecha_cierre}» no es una fecha (AAAA-MM-DD o DD/MM/AAAA).`);
  else if (cierre < hoy) errores.push(`fecha_cierre: ${cierre} ya pasó.`);
  const apertura = c.fecha_apertura ? leerFecha(c.fecha_apertura) : "";
  if (apertura === null) errores.push(`fecha_apertura: «${c.fecha_apertura}» no es una fecha (AAAA-MM-DD o DD/MM/AAAA).`);

  const categorias: string[] = [];
  for (const nombre of lista(c.categorias)) {
    const ids = listas.categorias.get(normalizar(nombre));
    if (ids) categorias.push(...ids);
    else errores.push(`categorias: «${nombre}» no existe o está inactiva.`);
  }

  // RF-07, RNF-18 · Cada archivo nombrado tiene que estar entre los elegidos, con formato y tamaño admitidos.
  const leidos = leerDocumentos(c.documentos);
  errores.push(...leidos.errores);
  const documentos: DocumentoCarga[] = [];
  for (const { archivo, tipo } of leidos.documentos) {
    const elegido = archivos.get(archivo.toLowerCase());
    if (!EXTENSIONES.includes(extensionDe(archivo))) {
      errores.push(`documentos: ${archivo} no es PDF, Word, Excel ni ZIP.`);
    } else if (!elegido) {
      errores.push(`documentos: no elegiste el archivo ${archivo}. Elígelo junto con el CSV (el nombre debe ser exacto).`);
    } else if (elegido.tamanoBytes > TAMANO_MAXIMO) {
      errores.push(`documentos: ${archivo} pasa de 20 MB.`);
    } else if (documentos.some((d) => d.archivo === elegido.nombre)) {
      errores.push(`documentos: ${archivo} está dos veces en la fila.`);
    } else {
      documentos.push({ archivo: elegido.nombre, tipo });
    }
  }

  if (errores.length > 0) return { errores };

  const validada = validarFicha({
    fuenteId,
    nombre: c.nombre,
    entidadConvocante: c.entidad_convocante,
    descripcion: c.descripcion ?? "",
    tipo: tipo ?? "fondo",
    origen: origen ?? "publico",
    moneda,
    montoMin: c.monto_minimo ?? "",
    montoMax: c.monto_maximo ?? "",
    todosLosPaises,
    paises,
    coberturaNacional: SI.has(nacional),
    departamentos,
    ubicacion: c.ubicacion_detalle ?? "",
    fechaApertura: apertura ?? "",
    fechaCierre: cierre,
    urlPostulacion: c.url_postulacion ?? "",
    categorias,
    requisitos: [...requisitos(c.requisitos_documentos, "documento"), ...requisitos(c.requisitos_condiciones, "condicion")],
  });
  if (!validada.ok) return { errores: [validada.error] };
  return { ficha: validada.ficha, fuenteId: fuenteId!, documentos };
}

/** `archivos`: `[{ nombre, tamanoBytes }]` de los documentos elegidos en la pantalla. */
function leerArchivos(valor: unknown): Map<string, ArchivoElegido> | null {
  if (valor === undefined) return new Map();
  if (!Array.isArray(valor) || valor.length > 1000) return null;
  const archivos = new Map<string, ArchivoElegido>();
  for (const a of valor as Record<string, unknown>[]) {
    const nombre = typeof a?.nombre === "string" ? a.nombre.trim() : "";
    const tamano = Number(a?.tamanoBytes);
    if (!nombre || nombre.length > 255 || !Number.isFinite(tamano) || tamano < 0) return null;
    archivos.set(nombre.toLowerCase(), { nombre, tamanoBytes: tamano });
  }
  return archivos;
}

/**
 * `{ csv, confirmar }`. Con `confirmar: false` solo valida (vista previa); con
 * `true` vuelve a validar todo y crea en borrador las filas válidas.
 */
export async function cargaMasiva(cuerpo: Cuerpo, usuarioId: string): Promise<Resultado<ResultadoCarga>> {
  if (typeof cuerpo?.csv !== "string") return { ok: false, status: 400, error: "Sube un archivo CSV." };
  const confirmar = cuerpo.confirmar === true;
  const leido = leerCsv(cuerpo.csv);
  if (!leido.ok) return { ok: false, status: 400, error: leido.error };
  const archivos = leerArchivos(cuerpo.archivos);
  if (!archivos) return { ok: false, status: 400, error: "La lista de documentos elegidos no es válida." };

  const listas = await leerListas();
  const hoy = hoyColombia();
  const vistas = new Set<string>();
  const filas: FilaCarga[] = [];
  const porCrear: Array<{ fila: FilaCarga; ficha: FichaValidada; fuenteId: string }> = [];
  const nombrados = new Set<string>();

  for (const { numero, celdas } of leido.filas) {
    const fila: FilaCarga = { numero, nombre: celdas.nombre ?? "", estado: "valida", errores: [], documentos: [] };
    filas.push(fila);
    for (const archivo of leerDocumentos(celdas.documentos).nombrados) nombrados.add(archivo.toLowerCase());
    const traducida = traducirFila(celdas, listas, hoy, archivos);
    if ("errores" in traducida) {
      fila.estado = "error";
      fila.errores = traducida.errores;
      continue;
    }
    // CU-50 4a · Ni contra el catálogo ni dentro del archivo: subirlo dos veces no duplica.
    const clave = claveDuplicado(celdas.nombre, celdas.entidad_convocante);
    if (listas.existentes.has(clave)) {
      fila.estado = "duplicada";
      fila.errores = ["Ya existe una convocatoria con este nombre y esta entidad."];
    } else if (vistas.has(clave)) {
      fila.estado = "duplicada";
      fila.errores = ["Repite una fila anterior del archivo (mismo nombre y entidad)."];
    } else {
      vistas.add(clave);
      fila.documentos = traducida.documentos;
      porCrear.push({ fila, ficha: traducida.ficha, fuenteId: traducida.fuenteId });
    }
  }

  const archivosSinUsar = [...archivos.entries()].filter(([clave]) => !nombrados.has(clave)).map(([, a]) => a.nombre);
  const resultado: ResultadoCarga = { confirmado: confirmar, filas, validas: porCrear.length, creadas: 0, archivosSinUsar };
  if (!confirmar || porCrear.length === 0) return { ok: true, datos: resultado };

  const supabase = await crearClienteServidor();
  for (const { fila, ficha, fuenteId } of porCrear) {
    const datos = ficha.p_datos;
    const { data, error } = await supabase
      .from("convocatorias")
      .insert({
        fuente_id: fuenteId,
        nombre: datos.nombre,
        entidad_convocante: datos.entidad_convocante,
        fecha_cierre: datos.fecha_cierre,
        estado: "borrador",
        creado_por: usuarioId,
      })
      .select("id")
      .single();
    if (error) {
      fila.estado = "fallo";
      fila.errores = [rechazo(error, "carga masiva: crear").error];
      continue;
    }
    fila.id = data.id;
    const { error: eGuardar } = await supabase.rpc("guardar_convocatoria", { p_id: data.id, ...ficha });
    if (eGuardar) {
      // No debería pasar: todo se validó antes. La convocatoria no se borra (RN-07); queda en borrador con lo mínimo.
      fila.estado = "fallo";
      fila.errores = [`Se creó el borrador, pero no se guardó el resto de la ficha: ${rechazo(eGuardar, "carga masiva: guardar").error} Ábrela y complétala.`];
      continue;
    }
    fila.estado = "creada";
    resultado.creadas++;
  }
  refrescarIndicadores();
  return { ok: true, datos: resultado };
}
