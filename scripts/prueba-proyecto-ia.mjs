// Prueba de crear el proyecto con IA a partir de una explicación, contra
// Supabase real (CU-43 · RF-96, RF-97, RF-98, RF-52, RN-17, RN-37, RNF-20,
// RNF-30 · docs/05 §9.29 · sesión 030).
//
//   IA_PROVEEDOR=prueba npm run dev               (o la configuración "dev-ia-prueba")
//   node --env-file=.env.local scripts/prueba-proyecto-ia.mjs
//
// Con el proveedor de prueba no se gasta saldo: la propuesta copia la
// explicación como descripción, deja lo demás vacío y pide las categorías
// "c1" (existe) y "c999" (no existe); falla si la explicación contiene
// FALLA_IA_PRUEBA. Crea sus cuentas temporales y las borra al terminar.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import crypto from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.PRUEBA_URL ?? "http://localhost:3000";
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fallas = 0;
const ok = (c, d) => { console.log(c ? "ok   " : "FALLA", d); if (!c) fallas++; };

function sesion() {
  const jar = new Map();
  const cliente = createServerClient(URL_, ANON, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (c) => c.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) },
  });
  return { cliente, cookie: () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ") };
}
async function api(s, metodo, ruta, cuerpo, { origen = APP, formulario } = {}) {
  const headers = {};
  if (!formulario) headers["content-type"] = "application/json";
  if (s) headers.cookie = s.cookie();
  if (origen) headers.origin = origen;
  const body = formulario ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo));
  const r = await fetch(APP + ruta, { method: metodo, headers, redirect: "manual", body });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* HTML */ }
  return { status: r.status, json, destino: r.headers.get("location") };
}
const audio = (bytes, tipo = "audio/webm") => {
  const f = new FormData();
  f.append("audio", new Blob([crypto.randomBytes(bytes)], { type: tipo }), "dictado");
  f.append("segundos", "12");
  return f;
};

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [];
const usados = async (id) => (await svc.from("suscripciones").select("creditos_usados_periodo").eq("usuario_id", id).single()).data.creditos_usados_periodo;
const consumos = async (id, tipo) => (await svc.from("consumos_ia").select("exito, credito_descontado, tokens_entrada, costo_estimado, modelo").eq("usuario_id", id).eq("tipo", tipo)).data ?? [];

const EXPLICACION =
  "Somos una cooperativa de caficultores que quiere instalar secadores solares para mejorar la calidad del café y reducir pérdidas en la cosecha. " +
  "Beneficiaría a 120 familias productoras.";

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre, extra = {}) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.pia.${sufijo}@example.com`, password: clave, email_confirm: true,
      user_metadata: { rol, nombre, consentimiento_datos: true, ...extra },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    const s = sesion();
    const { error: e } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (e) throw e;
    s.id = data.user.id;
    return s;
  };
  const e1 = await crearCuenta("empresa", "empresa1", { nombre_empresa: `Empresa Uno ${sufijo}` });
  const e2 = await crearCuenta("empresa", "empresa2", { nombre_empresa: `Empresa Dos ${sufijo}` });
  const c = await crearCuenta("consultor", "consultor");

  // --- Autorización (RNF-30) ---------------------------------------------------------
  const anon = await api(null, "POST", "/api/proyectos/estructurar", { explicacion: EXPLICACION });
  ok(anon.status === 307 && /\/login/.test(anon.destino ?? ""), `RNF-30: anónimo -> /login (${anon.status})`);
  ok((await api(c, "POST", "/api/proyectos/estructurar", { explicacion: EXPLICACION })).status === 403, "CU-43: el consultor no estructura -> 403");
  // Antes proxy.ts reescribía la denegación a la página /acceso-denegado y Next
  // respondía 404 o 500 a este POST multipart; desde la sesión 030 un /api
  // denegado responde 403 en JSON.
  const tc = await api(c, "POST", "/api/proyectos/transcribir", undefined, { formulario: audio(2000) });
  ok(tc.status === 403 && tc.json?.error, `RF-97: el consultor no transcribe -> 403 en JSON (${tc.status})`);
  ok((await api(e1, "POST", "/api/proyectos/estructurar", { explicacion: EXPLICACION }, { origen: "https://otro.example" })).status === 403,
    "RNF-30: estructurar desde otro origen -> 403");
  ok((await api(e1, "POST", "/api/proyectos/transcribir", undefined, { formulario: audio(2000), origen: "https://otro.example" })).status === 403,
    "RNF-30: transcribir desde otro origen -> 403");

  // --- Validación (CU-43 3a) ---------------------------------------------------------
  const corta = await api(e1, "POST", "/api/proyectos/estructurar", { explicacion: "Un proyecto de café." });
  ok(corta.status === 400 && (await usados(e1.id)) === 0, `CU-43 3a: explicación corta -> 400 y no cobra (${corta.status})`);
  ok((await api(e1, "POST", "/api/proyectos/estructurar", { explicacion: "x".repeat(8001) })).status === 400, "RF-96: más de 8.000 caracteres -> 400");

  // --- RN-17: la fallida no cobra ----------------------------------------------------
  const fallida = await api(e1, "POST", "/api/proyectos/estructurar", { explicacion: `${EXPLICACION} FALLA_IA_PRUEBA` });
  ok(fallida.status === 502 && /No se descontó ningún crédito/.test(fallida.json?.error ?? ""), `CU-43 4a: fallo controlado con su mensaje (${fallida.status})`);
  const cf = await consumos(e1.id, "estructuracion");
  ok((await usados(e1.id)) === 0 && cf.length === 1 && !cf[0].exito && !cf[0].credito_descontado && cf[0].tokens_entrada > 0,
    "RN-17, RF-52: no descuenta y deja el consumo fallido con sus tokens");
  const { count: reservas } = await svc.from("reservas_estructuracion").select("id", { count: "exact", head: true }).eq("usuario_id", e1.id);
  ok(reservas === 0, "RN-17: la reserva del fallo se libera");

  // --- Estructurar (RF-96) -----------------------------------------------------------
  const r = await api(e1, "POST", "/api/proyectos/estructurar", { explicacion: EXPLICACION });
  const p = r.json?.datos;
  ok(r.status === 200 && p?.descripcion === EXPLICACION && p?.nombre, `RF-96: devuelve la propuesta (${r.status})`);
  const { data: activas } = await svc.from("categorias").select("id").eq("activa", true);
  const idsActivos = new Set((activas ?? []).map((x) => x.id));
  ok(Array.isArray(p?.categorias) && p.categorias.length === 1 && idsActivos.has(p.categorias[0]),
    "RN-37: la clave conocida se traduce a una categoría activa y la desconocida se descarta");
  ok(p?.montoBuscado === null && p?.departamento === null && p?.faltantes?.length === 2, "RN-37: lo no dicho queda vacío y se lista en faltantes");
  ok((await usados(e1.id)) === 1, "RN-17: la propuesta entregada cobra un crédito");
  const ce = (await consumos(e1.id, "estructuracion")).filter((x) => x.exito);
  ok(ce.length === 1 && ce[0].credito_descontado && ce[0].modelo, "RF-52: consumo con éxito, crédito y modelo");
  const { count: proyectos } = await svc.from("proyectos").select("id", { count: "exact", head: true }).eq("usuario_id", e1.id);
  ok(proyectos === 0, "RN-37: estructurar no guarda el proyecto");

  // --- Guardar la propuesta y ver sus sugerencias (CU-43 7-8, RF-98) -----------------
  const guardado = await api(e1, "POST", "/api/proyectos", { ...p, montoBuscado: "", presupuestoEstimado: "", duracionMeses: "" });
  const idProyecto = guardado.json?.datos?.id;
  ok(guardado.status === 200 && idProyecto && guardado.json.datos.categorias.length === 1, `CU-43 8: la propuesta revisada se guarda con su categoría (${guardado.status})`);
  const sug = await api(e1, "GET", `/api/proyectos/${idProyecto}/sugerencias`);
  ok(sug.status === 200, `RF-98: las sugerencias del proyecto nuevo responden (${sug.status})`);
  ok((await api(e2, "GET", `/api/proyectos/${idProyecto}/sugerencias`)).status === 404, "RN-30: otra empresa no ve las sugerencias de ese proyecto");

  // --- Transcribir (RF-97) -----------------------------------------------------------
  const t = await api(e1, "POST", "/api/proyectos/transcribir", undefined, { formulario: audio(2000) });
  ok(t.status === 200 && /Transcripción de prueba/.test(t.json?.datos?.texto ?? ""), `RF-97: transcribe el audio (${t.status})`);
  ok((await usados(e1.id)) === 1, "RF-97: transcribir no cobra crédito");
  const ct = await consumos(e1.id, "transcripcion");
  ok(ct.length === 1 && ct[0].exito && !ct[0].credito_descontado && Number(ct[0].costo_estimado) > 0, "RF-52: la transcripción queda registrada con su costo estimado");
  ok((await api(e1, "POST", "/api/proyectos/transcribir", undefined, { formulario: new FormData() })).status === 400, "RF-97: sin audio -> 400");
  ok((await api(e1, "POST", "/api/proyectos/transcribir", undefined, { formulario: audio(2000, "text/plain") })).status === 415, "RF-97: otro tipo de archivo -> 415");
  ok((await api(e1, "POST", "/api/proyectos/transcribir", undefined, { formulario: audio(4 * 1024 * 1024 + 10) })).status === 413, "RF-97: más de 4 MB -> 413");

  // --- Sin crédito (CU-43 3b) --------------------------------------------------------
  await svc.from("suscripciones").update({ creditos_usados_periodo: 3 }).eq("usuario_id", e1.id);
  const sinCredito = await api(e1, "POST", "/api/proyectos/estructurar", { explicacion: EXPLICACION });
  ok(sinCredito.status === 402 && /a mano/.test(sinCredito.json?.error ?? ""), `CU-43 3b: sin crédito -> 402 y ofrece el formulario (${sinCredito.status})`);
  ok((await api(e1, "POST", "/api/proyectos/transcribir", undefined, { formulario: audio(2000) })).status === 402, "RF-97: sin crédito tampoco transcribe -> 402");
} catch (e) {
  console.error("Error inesperado:", e);
  fallas++;
} finally {
  for (const id of cuentas) {
    await svc.from("consumos_ia").delete().eq("usuario_id", id);
    await svc.from("proyectos").delete().eq("usuario_id", id);
    await svc.auth.admin.deleteUser(id);
  }
  const { count } = await svc.from("perfiles").select("id", { count: "exact", head: true }).in("id", cuentas);
  console.log(`\nCuentas temporales sobrantes: ${count ?? "?"}`);
  console.log(fallas === 0 ? "TODAS LAS COMPROBACIONES PASARON" : `${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
