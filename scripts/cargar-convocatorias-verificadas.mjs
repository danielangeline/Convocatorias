// Carga de convocatorias vigentes verificadas contra su fuente oficial (sesión 029; por lotes desde la 032).
//
//   node --env-file=.env.local scripts/cargar-convocatorias-verificadas.mjs --lote scripts/convocatorias/lote-AAAA-MM-DD.mjs            (simulacro)
//   node --env-file=.env.local scripts/cargar-convocatorias-verificadas.mjs --lote scripts/convocatorias/lote-AAAA-MM-DD.mjs --aplicar
//
// El lote exporta FUENTES, CATEGORIAS y CONVOCATORIAS. Cada convocatoria puede declarar
// `origen` (publico, privado o cooperacion) y `tipo` (fondo o beneficio_tributario), RF-102;
// sin ellos quedan los valores por defecto de la tabla.
//
// DOCS_DIR (por defecto ./tmp-convocatorias) debe tener los archivos oficiales que cita
// cada convocatoria en `documentos`. Cada dato sale de la página o del documento oficial
// de la convocatoria (RNF-23: nada inventado); lo que la fuente no dice queda en null.
// Es idempotente: una convocatoria que ya existe por nombre se omite.
//
// Escribe con la clave de servicio, que se salta la RLS, así que replica aquí la lista de
// RN-01 (privado.ficha_publicable) y no publica ninguna ficha que no la cumpla.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const APLICAR = process.argv.includes("--aplicar");
const DOCS_DIR = process.env.DOCS_DIR ?? "./tmp-convocatorias";
const BUCKET = "documentos-convocatorias";
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const iLote = process.argv.indexOf("--lote");
if (iLote < 0 || !process.argv[iLote + 1]) { console.log("Falta --lote <ruta del lote>"); process.exit(1); }
const { FUENTES, CATEGORIAS, CONVOCATORIAS } = await import(pathToFileURL(path.resolve(process.argv[iLote + 1])).href);
const HOY = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

// ---------------------------------------------------------------------------
const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const log = (...a) => console.log(...a);
let errores = 0;
const falla = (m) => { errores++; console.log("FALLA", m); };

async function fuenteId(clave) {
  const f = FUENTES[clave];
  const { data } = await svc.from("fuentes").select("id, nombre");
  const hallada = data.find((x) => norm(x.nombre) === norm(f.nombre));
  if (hallada) return hallada.id;
  if (!APLICAR) return `(nueva) ${f.nombre}`;
  const { data: nueva, error } = await svc.from("fuentes").insert({ nombre: f.nombre, tipo_entidad: f.tipo_entidad, url: f.url, activa: true }).select("id").single();
  if (error) throw new Error(`fuente ${f.nombre}: ${error.message}`);
  return nueva.id;
}

async function categoriasPorNombre() {
  const mapa = new Map();
  // El índice único de categorías es sobre el nombre normalizado (sin tildes ni mayúsculas).
  const { data: existentes } = await svc.from("categorias").select("id, tipo, nombre");
  for (const [tipo, nombres] of Object.entries(CATEGORIAS)) {
    for (const nombre of nombres) {
      let id = existentes.find((x) => x.tipo === tipo && norm(x.nombre) === norm(nombre))?.id;
      if (!id && APLICAR) {
        const { data: nueva, error } = await svc.from("categorias").insert({ tipo, nombre, activa: true }).select("id").single();
        if (error) throw new Error(`categoría ${nombre}: ${error.message}`);
        id = nueva.id;
      }
      mapa.set(`${tipo}|${nombre}`, id ?? `(nueva) ${nombre}`);
    }
  }
  return mapa;
}

const { data: deptosDb } = await svc.from("departamentos").select("codigo, nombre");
const deptoCodigo = (nombre) => {
  const h = deptosDb.find((d) => norm(d.nombre).startsWith(norm(nombre)));
  if (!h) throw new Error(`Departamento no encontrado: ${nombre}`);
  return h.codigo;
};

function validar(c) {
  const dias = (Date.parse(c.cierre) - Date.parse(HOY)) / 86400000;
  if (dias < 0) falla(`${c.nombre}: la fecha de cierre ya pasó`);
  if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(c.url)) falla(`${c.nombre}: URL de postulación inválida`);
  if (c.requisitos.length < 2) falla(`${c.nombre}: menos de 2 requisitos (RN-01)`);
  if (!c.documentos.length) falla(`${c.nombre}: sin documentos (RN-01)`);
  if (!c.nacional && !c.deptos?.length) falla(`${c.nombre}: sin cobertura (RN-34)`);
  for (const d of c.documentos) if (!fs.existsSync(path.join(DOCS_DIR, d.archivo))) falla(`${c.nombre}: falta el archivo ${d.archivo}`);
  const cats = Object.values(c.categorias).flat();
  if (!cats.length) falla(`${c.nombre}: sin categorías`);
  for (const [tipo, nombres] of Object.entries(c.categorias)) for (const n of nombres) if (!CATEGORIAS[tipo].includes(n)) falla(`${c.nombre}: categoría desconocida ${tipo}/${n}`);
  if (c.montoMin != null && c.montoMax != null && c.montoMin > c.montoMax) falla(`${c.nombre}: rango de montos`);
  if (c.origen && !["publico", "privado", "cooperacion"].includes(c.origen)) falla(`${c.nombre}: origen inválido`);
  if (c.tipo && !["fondo", "beneficio_tributario"].includes(c.tipo)) falla(`${c.nombre}: tipo inválido`);
  if (c.apertura && c.apertura > c.cierre) falla(`${c.nombre}: la apertura es posterior al cierre`);
}

CONVOCATORIAS.forEach(validar);
if (errores) { console.log(`\n${errores} problemas: no se escribe nada.`); process.exit(1); }

const catMapa = await categoriasPorNombre();
let creadas = 0, omitidas = 0;

for (const c of CONVOCATORIAS) {
  const { data: previa } = await svc.from("convocatorias").select("id, estado").eq("nombre", c.nombre).maybeSingle();
  if (previa) { omitidas++; log("omite (ya existe):", c.nombre.slice(0, 70)); continue; }
  log(APLICAR ? "crea:" : "crearía:", c.nombre.slice(0, 80), "· cierre", c.cierre, "· docs", c.documentos.length, "· reqs", c.requisitos.length);
  if (!APLICAR) continue;

  const fid = await fuenteId(c.fuente);
  const { data: conv, error } = await svc.from("convocatorias").insert({
    fuente_id: fid, nombre: c.nombre, entidad_convocante: c.entidad, descripcion: c.descripcion,
    monto_min: c.montoMin, monto_max: c.montoMax, ubicacion_cobertura: c.ubicacion, cobertura_nacional: !!c.nacional,
    fecha_apertura: c.apertura, fecha_cierre: c.cierre, url_postulacion: c.url, estado: "borrador",
    ...(c.origen && { origen: c.origen }), ...(c.tipo && { tipo_convocatoria: c.tipo }),
  }).select("id").single();
  if (error) throw new Error(`${c.nombre}: ${error.message}`);
  const id = conv.id;

  const cats = Object.entries(c.categorias).flatMap(([tipo, ns]) => ns.map((n) => catMapa.get(`${tipo}|${n}`)));
  let r = await svc.from("convocatoria_categoria").insert(cats.map((categoria_id) => ({ convocatoria_id: id, categoria_id })));
  if (r.error) throw new Error(`categorías ${c.nombre}: ${r.error.message}`);

  if (!c.nacional) {
    r = await svc.from("convocatoria_departamento").insert(c.deptos.map((d) => ({ convocatoria_id: id, departamento_codigo: deptoCodigo(d) })));
    if (r.error) throw new Error(`departamentos ${c.nombre}: ${r.error.message}`);
  }

  r = await svc.from("requisitos_convocatoria").insert(c.requisitos.map(([tipo, descripcion], i) => ({ convocatoria_id: id, tipo, descripcion, obligatorio: true, orden: i + 1 })));
  if (r.error) throw new Error(`requisitos ${c.nombre}: ${r.error.message}`);

  for (const d of c.documentos) {
    const buf = fs.readFileSync(path.join(DOCS_DIR, d.archivo));
    const docId = crypto.randomUUID();
    const ruta = `${id}/${docId}.pdf`;
    const up = await svc.storage.from(BUCKET).upload(ruta, buf, { contentType: "application/pdf", upsert: false });
    if (up.error) throw new Error(`subida ${d.archivo}: ${up.error.message}`);
    r = await svc.from("documentos_convocatoria").insert({ id: docId, convocatoria_id: id, tipo_doc: d.tipo_doc, nombre: d.nombre, storage_path: ruta, tipo_mime: "application/pdf", tamano_bytes: buf.length });
    if (r.error) throw new Error(`documento ${d.nombre}: ${r.error.message}`);
  }

  // RN-01: la misma lista de privado.ficha_publicable.
  const [{ count: nc }, { count: nd }, { count: nr }, { count: nx }] = await Promise.all([
    svc.from("convocatoria_categoria").select("*", { count: "exact", head: true }).eq("convocatoria_id", id),
    svc.from("documentos_convocatoria").select("*", { count: "exact", head: true }).eq("convocatoria_id", id),
    svc.from("requisitos_convocatoria").select("*", { count: "exact", head: true }).eq("convocatoria_id", id),
    svc.from("convocatoria_departamento").select("*", { count: "exact", head: true }).eq("convocatoria_id", id),
  ]);
  const publicable = nc >= 1 && nd >= 1 && nr >= 2 && (c.nacional || nx >= 1);
  if (!publicable) { falla(`${c.nombre}: la ficha no cumple RN-01, queda en borrador`); continue; }
  r = await svc.from("convocatorias").update({ estado: "publicada", publicada_at: new Date().toISOString() }).eq("id", id);
  if (r.error) throw new Error(`publicar ${c.nombre}: ${r.error.message}`);
  creadas++;
}

log(`\n${APLICAR ? "Creadas y publicadas" : "Se crearían"}: ${APLICAR ? creadas : CONVOCATORIAS.length - omitidas} · omitidas: ${omitidas} · problemas: ${errores}`);
process.exit(errores ? 1 : 0);
