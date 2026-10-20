// Medición de la generación con el modelo real de OpenAI (RNF-21, RNF-23,
// RF-52, RN-17 · Sprint 5 · sesión 027). GASTA SALDO: úsese a propósito.
//
//   npm run dev                                   (sin IA_PROVEEDOR=prueba)
//   node --env-file=.env.local scripts/medicion-ia-real.mjs [n] [topeUSD]
//
// Copia en una convocatoria temporal, vigente y publicada, los datos, los
// requisitos y el TDR de una convocatoria real ya cargada (por defecto la de
// Minciencias de la sesión 016), crea una empresa temporal con créditos extra y
// proyectos con distinto grado de completitud, y genera `n` documentos (20 por
// defecto). Se detiene si el costo acumulado supera `topeUSD` (2 por defecto).
// Guarda el detalle y los documentos en `MEDICION_SALIDA` (o el directorio
// temporal) para la revisión de veracidad, y borra todo al terminar.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const N = Number(process.argv[2] ?? 20), TOPE = Number(process.argv[3] ?? 2);
const ORIGEN = process.env.MEDICION_CONVOCATORIA ?? "61041eba-99e5-4ab4-a9c7-cf0ce288a43f";
const SALIDA = process.env.MEDICION_SALIDA ?? path.join(os.tmpdir(), "medicion-ia");
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.PRUEBA_URL ?? "http://localhost:3000";
const BUCKET = "documentos-convocatorias";
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function sesion() {
  const jar = new Map();
  const cliente = createServerClient(URL_, ANON, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (c) => c.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) },
  });
  return { cliente, cookie: () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ") };
}
async function api(s, metodo, ruta, cuerpo) {
  const r = await fetch(APP + ruta, {
    method: metodo, redirect: "manual",
    headers: { "content-type": "application/json", cookie: s.cookie(), origin: APP },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
const sinMeta = ({ id, convocatoria_id, creado_at, actualizado_at, ...resto }) => resto;

const sufijo = crypto.randomBytes(3).toString("hex");
const hoy = new Date(Date.now() - 5 * 3600 * 1000);
const enDias = (n) => new Date(hoy.getTime() + n * 86400000).toISOString().slice(0, 10);
let cuenta = null, convocatoria = null;
const rutas = [];
fs.mkdirSync(SALIDA, { recursive: true });

// Tres proyectos de prueba con datos inventados por la prueba (son "del usuario"):
// completo, a medias y casi vacío, para ver cómo cambian los [COMPLETAR].
const PROYECTOS = [
  {
    nombre: `Telemedicina para la atención de salud mental tras inundaciones ${sufijo}`,
    descripcion: "Plataforma de teleconsulta psicológica y seguimiento comunitario para municipios afectados por inundaciones en La Mojana.",
    ubicacion: "Sucre", monto_buscado: 850000000, presupuesto_estimado: 1100000000, duracion_meses: 18,
    problema: "Tras las inundaciones de 2024 en La Mojana, la población afectada no tiene acceso a atención en salud mental: los centros de salud más cercanos están a más de dos horas y no tienen psicólogos.",
    objetivo_general: "Reducir la brecha de atención en salud mental de la población damnificada mediante un modelo de telepsicología con agentes comunitarios.",
    objetivos_especificos: ["Formar 40 agentes comunitarios en primeros auxilios psicológicos", "Implementar una plataforma de teleconsulta que funcione con baja conectividad", "Evaluar el efecto del modelo en síntomas de ansiedad y depresión"],
    poblacion_beneficiaria: "3.000 personas damnificadas de cuatro municipios de La Mojana sucreña.",
    actividades: "Diagnóstico participativo, desarrollo de la plataforma, formación de agentes, piloto de 9 meses y evaluación con escalas validadas.",
    resultados_esperados: "Modelo validado, protocolo publicado y transferencia a la ESE departamental.",
    experiencia_empresa: "La empresa desarrolló en 2022 una aplicación de citas médicas para dos IPS de Sincelejo.",
  },
  {
    nombre: `Monitoreo de calidad del agua en zonas inundadas ${sufijo}`,
    descripcion: "Sensores de bajo costo para vigilar la calidad del agua de consumo en comunidades rurales tras una emergencia.",
    ubicacion: "Córdoba", duracion_meses: 12,
    problema: "Después de las inundaciones aumentan las enfermedades diarreicas por consumo de agua contaminada.",
    objetivo_general: "Detectar a tiempo la contaminación del agua de consumo en veredas afectadas.",
  },
  { nombre: `Proyecto de salud rural ${sufijo}`, ubicacion: "Bolívar" },
];

const filas = [];
try {
  // --- Convocatoria temporal, copia de la real ---------------------------------------------
  const { data: real, error: eReal } = await svc.from("convocatorias").select("*").eq("id", ORIGEN).single();
  if (eReal) throw eReal;
  const { data: conv, error: eConv } = await svc.from("convocatorias").insert({
    nombre: `${real.nombre} [medición ${sufijo}]`, entidad_convocante: real.entidad_convocante, descripcion: real.descripcion,
    monto_min: real.monto_min, monto_max: real.monto_max, cobertura_nacional: real.cobertura_nacional,
    ubicacion_cobertura: real.ubicacion_cobertura, fecha_apertura: real.fecha_apertura, fecha_cierre: enDias(20),
    estado: "publicada", url_postulacion: real.url_postulacion,
  }).select("id").single();
  if (eConv) throw eConv;
  convocatoria = conv.id;
  const { data: reqs } = await svc.from("requisitos_convocatoria").select("*").eq("convocatoria_id", ORIGEN);
  if (reqs?.length) {
    const { error } = await svc.from("requisitos_convocatoria").insert(reqs.map((r) => ({ ...sinMeta(r), convocatoria_id: convocatoria })));
    if (error) throw error;
  }
  const { data: adjuntos } = await svc.from("documentos_convocatoria").select("*").eq("convocatoria_id", ORIGEN).in("tipo_doc", ["TDR", "terminos"]);
  for (const a of adjuntos ?? []) {
    const destino = `${convocatoria}/${crypto.randomUUID()}${path.extname(a.storage_path)}`;
    const { error: eCopia } = await svc.storage.from(BUCKET).copy(a.storage_path, destino);
    if (eCopia) throw eCopia;
    rutas.push(destino);
    const { error } = await svc.from("documentos_convocatoria").insert({ ...sinMeta(a), convocatoria_id: convocatoria, storage_path: destino });
    if (error) throw error;
  }
  console.log(`Convocatoria temporal con ${reqs?.length ?? 0} requisitos y ${adjuntos?.length ?? 0} TDR.`);

  // --- Empresa temporal con créditos para la medición -------------------------------------
  const clave = crypto.randomBytes(18).toString("base64url");
  const { data: u, error: eU } = await svc.auth.admin.createUser({
    email: `medicion.ia.${sufijo}@example.com`, password: clave, email_confirm: true,
    user_metadata: { rol: "empresa", nombre: "Medición IA", nombre_empresa: `Medición IA ${sufijo}`, consentimiento_datos: true },
  });
  if (eU) throw eU;
  cuenta = u.user.id;
  await svc.from("suscripciones").update({ creditos_extra: N + 5 }).eq("usuario_id", cuenta);
  const s = sesion();
  const { error: eS } = await s.cliente.auth.signInWithPassword({ email: u.user.email, password: clave });
  if (eS) throw eS;
  const proyectos = [];
  for (const p of PROYECTOS) {
    const { data, error } = await svc.from("proyectos").insert({ usuario_id: cuenta, ...p }).select("id, completitud").single();
    if (error) throw error;
    proyectos.push(data);
  }

  // --- Generaciones -----------------------------------------------------------------------
  let gasto = 0;
  for (let i = 0; i < N; i++) {
    const proyecto = proyectos[i % proyectos.length];
    const t0 = Date.now();
    const r = await api(s, "POST", "/api/documentos/generar", { proyectoId: proyecto.id, convocatoriaId: convocatoria });
    const ms = Date.now() - t0;
    const id = r.json?.datos?.id;
    const { data: consumos } = await svc.from("consumos_ia").select("tokens_entrada, tokens_salida, costo_estimado, exito, credito_descontado, mensaje_error, duracion_ms")
      .eq("empresa_id", cuenta).order("fecha", { ascending: false }).limit(1);
    const c = consumos?.[0] ?? {};
    gasto += Number(c.costo_estimado ?? 0);
    let pendientes = null, secciones = null;
    if (id) {
      const d = await api(s, "GET", `/api/documentos/${id}`);
      pendientes = d.json?.datos?.pendientes?.length ?? null;
      secciones = d.json?.datos?.secciones?.length ?? null;
      fs.writeFileSync(path.join(SALIDA, `documento-${String(i + 1).padStart(2, "0")}.json`), JSON.stringify(d.json?.datos, null, 2));
    }
    const fila = { n: i + 1, proyecto: (i % proyectos.length) + 1, completitud: proyecto.completitud, status: r.status, ms, duracion_ms: c.duracion_ms,
      tokens_entrada: c.tokens_entrada, tokens_salida: c.tokens_salida, costo: Number(c.costo_estimado ?? 0), exito: c.exito,
      credito: c.credito_descontado, secciones, pendientes, error: r.json?.error ?? c.mensaje_error ?? null };
    filas.push(fila);
    console.log(JSON.stringify(fila), `acumulado USD ${gasto.toFixed(4)}`);
    if (gasto > TOPE) { console.log(`Tope de USD ${TOPE} superado: se detiene.`); break; }
  }

  const exitosas = filas.filter((f) => f.status === 201);
  const tiempos = exitosas.map((f) => f.ms).sort((a, b) => a - b);
  const resumen = {
    generaciones: filas.length, exitosas: exitosas.length,
    mediana_ms: tiempos[Math.floor(tiempos.length / 2)] ?? null, max_ms: tiempos.at(-1) ?? null,
    sobre_120s: filas.filter((f) => f.ms > 120000).length,
    fallidas_cobradas: filas.filter((f) => f.status !== 201 && f.credito).length,
    costo_total_usd: Number(gasto.toFixed(4)), costo_medio_usd: exitosas.length ? Number((gasto / filas.length).toFixed(4)) : null,
  };
  console.log("RESUMEN", JSON.stringify(resumen));
  fs.writeFileSync(path.join(SALIDA, "medicion.json"), JSON.stringify({ resumen, filas }, null, 2));
  console.log("Detalle en", SALIDA);
} finally {
  if (cuenta) await svc.auth.admin.deleteUser(cuenta);
  if (rutas.length) await svc.storage.from(BUCKET).remove(rutas);
  if (convocatoria) {
    // Los documentos primero (FK sin cascada), como en prueba-generacion-ia.mjs.
    await svc.from("documentos_generados").delete().eq("convocatoria_id", convocatoria);
    const { error } = await svc.from("convocatorias").delete().eq("id", convocatoria);
    if (error) console.error("no se pudo borrar la convocatoria", convocatoria, error.message);
  }
  console.log("Limpieza hecha.");
}
