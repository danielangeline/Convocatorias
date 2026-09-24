// Prueba de las sugerencias y de la ubicación por departamentos contra Supabase
// real (CU-10, RF-15, RF-16, RN-05, RN-34, RNF-05, RNF-30 · docs/05 §9.6 y
// §9.18 · Sprint 3 paso 2).
//
//   npm run dev                                   (en otra terminal)
//   node --no-warnings --env-file=.env.local scripts/prueba-sugerencias.mjs
//
// Crea sus propias cuentas temporales (dos empresas y un consultor) y, con
// service_role, tres categorías y cuatro convocatorias. Borra todo al terminar.
// Importa `lib/sugerencias-calculo.ts` y `lib/departamentos.ts` directamente
// (Node 22 ejecuta TypeScript sin compilar).
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import crypto from "node:crypto";
import { datosFaltantes, separarSugerencias, MAXIMO_CERCANAS } from "../lib/sugerencias-calculo.ts";
import { DEPARTAMENTOS } from "../lib/departamentos.ts";

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
async function api(s, metodo, ruta, cuerpo) {
  const headers = { "content-type": "application/json", origin: APP };
  if (s) headers.cookie = s.cookie();
  const r = await fetch(APP + ruta, { method: metodo, headers, redirect: "manual", body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  // React separa los textos contiguos con <!-- -->; se quitan para buscar frases.
  const texto = (await r.text()).replaceAll("<!-- -->", "");
  let json = null;
  try { json = JSON.parse(texto); } catch { /* HTML */ }
  return { status: r.status, json, texto, destino: r.headers.get("location") };
}

const sufijo = crypto.randomBytes(3).toString("hex");
const hoyCO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const enDias = (n) => new Date(Date.parse(hoyCO) + n * 86400000).toISOString().slice(0, 10);
const cuentas = [], categorias = [], convocatorias = [];

// --- Parte pura (CU-10 2a) y lista de departamentos: no necesitan servidor --------------
{
  const f = (n) => ({ coincidencias: n });
  const ceros = Array.from({ length: 7 }, () => f(0));
  const sin = separarSugerencias(ceros);
  ok(sin.sugerencias.length === 0 && sin.cercanas.length === MAXIMO_CERCANAS && sin.cercanas[0] === ceros[0],
    `sin ninguna coincidencia: 0 sugerencias y las ${MAXIMO_CERCANAS} primeras como cercanas, en orden`);
  const con = separarSugerencias([f(0), f(2), f(0), f(1)]);
  ok(con.sugerencias.length === 2 && con.cercanas.length === 0, "con alguna coincidencia: solo esas, sin cercanas");
  ok(separarSugerencias([]).cercanas.length === 0, "sin vigentes: ni sugerencias ni cercanas");
  const todo = datosFaltantes({ tiposDeCategoria: new Set(), montoBuscado: null, departamento: null });
  ok(todo.join(",") === "tipo_proyecto,sector,tipo_entidad,monto,ubicacion", `proyecto vacío: le faltan los cinco, en orden (${todo})`);
  const casi = datosFaltantes({ tiposDeCategoria: new Set(["sector", "tipo_proyecto"]), montoBuscado: 0, departamento: "08" });
  ok(casi.join(",") === "tipo_entidad", `con monto 0, departamento y dos tipos: solo falta tipo de entidad (${casi})`);
}

try {
  const { data: deps } = await svc.from("departamentos").select("codigo, nombre").order("codigo");
  const local = [...DEPARTAMENTOS].sort((a, b) => a.codigo.localeCompare(b.codigo));
  ok(deps?.length === 33 && JSON.stringify(deps) === JSON.stringify(local), `lib/departamentos.ts coincide con la tabla (${deps?.length} filas)`);

  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.sugerencias.${sufijo}@example.com`, password: clave, email_confirm: true, user_metadata: { rol, nombre },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    const s = sesion();
    const { error: e } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (e) throw e;
    s.id = data.user.id;
    return s;
  };
  const a = await crearCuenta("empresa", "empresa-a");
  const b = await crearCuenta("empresa", "empresa-b");
  const con = await crearCuenta("consultor", "consultor");

  const categoria = async (tipo, nombre) => {
    const { data } = await svc.from("categorias").insert({ tipo, nombre: `${nombre} sugerencias ${sufijo}`, activa: true }).select("id").single();
    categorias.push(data.id);
    return data.id;
  };
  const tp = await categoria("tipo_proyecto", "Innovación");
  const se = await categoria("sector", "Agro");
  const te = await categoria("tipo_entidad", "Pyme");

  const convocatoria = async (nombre, { cats, deps = [], nacional = false, min = null, max = null, cierre = enDias(30) }) => {
    const { data, error } = await svc.from("convocatorias").insert({
      nombre: `${nombre} ${sufijo}`, entidad_convocante: "Entidad de prueba", monto_min: min, monto_max: max,
      cobertura_nacional: nacional, fecha_cierre: cierre, estado: "publicada", url_postulacion: "https://entidad.gov.co/x",
    }).select("id").single();
    if (error) throw error;
    convocatorias.push(data.id);
    await svc.from("convocatoria_categoria").insert(cats.map((c) => ({ convocatoria_id: data.id, categoria_id: c })));
    if (deps.length) await svc.from("convocatoria_departamento").insert(deps.map((d) => ({ convocatoria_id: data.id, departamento_codigo: d })));
    return data.id;
  };
  const X = await convocatoria("X nacional", { cats: [tp, se, te], nacional: true, min: 100000000, max: 500000000 });
  const Y = await convocatoria("Y Atlántico", { cats: [tp], deps: ["08", "13"], max: 150000000 });
  const Z = await convocatoria("Z Antioquia", { cats: [se], deps: ["05"], min: 1000000000 });
  const V = await convocatoria("V vencida", { cats: [tp, se, te], nacional: true, cierre: enDias(-1) });
  const nuestras = new Set([X, Y, Z, V]);

  // --- RN-34: el departamento del proyecto ----------------------------------------------
  for (const [dep, desc] of [["77", "código que no existe"], ["Atlántico", "nombre en lugar de código"], [8, "número"]]) {
    const r = await api(a, "POST", "/api/proyectos", { nombre: "x", departamento: dep });
    ok(r.status === 400 && /departamento/i.test(r.json?.error ?? ""), `proyecto con departamento ${desc} -> 400 (${r.status}: ${r.json?.error})`);
  }
  const rP = await api(a, "POST", "/api/proyectos", {
    nombre: `P completo ${sufijo}`, montoBuscado: "200.000.000", departamento: "08", ubicacion: "Barranquilla", categorias: [tp, se, te],
  });
  const P = rP.json?.datos;
  ok(rP.status === 200 && P?.departamento === "08" && P?.ubicacion === "Barranquilla", `proyecto con Atlántico y detalle -> 200 (${rP.status})`);
  const Q = (await api(a, "POST", "/api/proyectos", { nombre: `Q vacío ${sufijo}` })).json?.datos;
  ok(Q?.departamento === null, "proyecto sin departamento -> null, no un valor inventado");

  // --- RNF-30: quién llega ----------------------------------------------------------------
  const ruta = (id) => `/api/proyectos/${id}/sugerencias`;
  const anon = await api(null, "GET", ruta(P.id));
  ok(anon.status === 307 && /\/login/.test(anon.destino ?? ""), `visitante -> /login (${anon.status})`);
  ok((await api(con, "GET", ruta(P.id))).status === 403, "consultor -> 403");
  ok((await api(b, "GET", ruta(P.id))).status === 404, "empresa B pide las sugerencias del proyecto de A -> 404 (RN-30)");
  ok((await api(a, "GET", ruta("no-es-uuid"))).status === 404, "id que no es uuid -> 404");

  // --- RF-15, RF-16: cálculo ------------------------------------------------------------------
  const t0 = Date.now();
  const rS = await api(a, "GET", ruta(P.id));
  const ms = Date.now() - t0;
  const S = rS.json?.datos;
  ok(rS.status === 200, `A pide sus sugerencias -> 200 (${rS.status} ${rS.json?.error ?? ""})`);
  ok(ms < 3000, `responde en ${ms} ms (RNF-05: < 3 000, incluye la red)`);
  const mias = (S?.sugerencias ?? []).filter((s) => nuestras.has(s.convocatoria.id));
  ok(mias.map((s) => s.convocatoria.id).join() === [X, Y, Z].join(), "orden X, Y, Z y sin la vencida (RF-15)");
  const est = (s) => Object.fromEntries(s.criterios.map((c) => [c.clave, c.estado]));
  const [sx, sy, sz] = mias;
  ok(sx?.porcentaje === 100 && Object.values(est(sx)).every((e) => e === "cumple"), `X: nacional y todo coincide -> 100 % (${sx?.porcentaje})`);
  ok(sy?.porcentaje === 40 && est(sy).tipo_proyecto === "cumple" && est(sy).ubicacion === "cumple" && est(sy).monto === "no_cumple",
    `Y: Atlántico en {08,13} y tipo de proyecto; 200 M > 150 M no -> 40 % (${sy?.porcentaje})`);
  ok(sz?.porcentaje === 20 && est(sz).sector === "cumple" && est(sz).ubicacion === "no_cumple",
    `Z: solo el sector; Antioquia no es Atlántico -> 20 % (${sz?.porcentaje})`);
  ok(S?.faltan?.length === 0 && S?.cercanas?.length === 0, "a P no le falta nada y hay sugerencias: sin cercanas");

  const rQ = await api(a, "GET", ruta(Q.id));
  const sq = (rQ.json?.datos?.sugerencias ?? []).find((s) => s.convocatoria.id === X);
  ok(sq?.porcentaje === 20 && est(sq).ubicacion === "cumple" && est(sq).monto === "sin_dato" && est(sq).tipo_proyecto === "sin_dato",
    "Q vacío: X coincide solo por ser nacional; los demás criterios, sin dato");
  ok(rQ.json?.datos?.faltan?.map((f) => f.clave).join() === "tipo_proyecto,sector,tipo_entidad,monto,ubicacion", "a Q le faltan los cinco datos");
  ok(!(rQ.json?.datos?.sugerencias ?? []).some((s) => s.convocatoria.id === Y), "Q sin departamento no coincide con Y (departamental)");

  // --- CU-10 2b: sin suscripción ---------------------------------------------------------------
  const R = (await api(b, "POST", "/api/proyectos", { nombre: `R de B ${sufijo}`, departamento: "05" })).json?.datos;
  const { error: eSus } = await svc.from("suscripciones").update({ estado: "vencida", fecha_inicio: enDias(-60), fecha_vencimiento: enDias(-30) }).eq("usuario_id", b.id);
  ok(!eSus, `suscripción de B vencida ${eSus?.message ?? ""}`);
  const rVencida = await api(b, "GET", ruta(R.id));
  ok(rVencida.status === 402 && /suscripci/i.test(rVencida.json?.error ?? ""), `B con la suscripción vencida -> 402 (${rVencida.status})`);

  // --- RF-12: filtro del catálogo por departamento ------------------------------------------------
  const ids = async (qs) => new Set(((await api(a, "GET", `/api/convocatorias?${qs}`)).json?.datos ?? []).map((c) => c.id));
  const en08 = await ids("departamento=08");
  ok(en08.has(X) && en08.has(Y) && !en08.has(Z), "departamento=08 trae Y y la nacional X, no Z");
  const en05 = await ids("departamento=05");
  ok(en05.has(X) && en05.has(Z) && !en05.has(Y), "departamento=05 trae Z y la nacional X, no Y");
  ok((await api(a, "GET", "/api/convocatorias?departamento=77")).status === 400, "departamento=77 -> 400");

  // --- Pantallas -------------------------------------------------------------------------------------
  const pag = await api(a, "GET", `/proyectos/${P.id}/sugerencias`);
  ok(pag.status === 200 && pag.texto.includes(`X nacional ${sufijo}`) && pag.texto.includes("100% compatible") && pag.texto.includes("no es una predicción de éxito"),
    "A - la pantalla muestra X al 100 % y la aclaración de RN-05");
  const pagB = await api(b, "GET", `/proyectos/${P.id}/sugerencias`);
  // El catálogo vigente viaja en el layout del portal para cualquier empresa; lo que no debe verse es el proyecto de A.
  ok(pagB.status === 200 && pagB.texto.includes("No encontramos este proyecto") && !pagB.texto.includes(`P completo ${sufijo}`),
    "B - la pantalla de sugerencias de un proyecto de A no lo muestra");
  const pagVencida = await api(b, "GET", `/proyectos/${R.id}/sugerencias`);
  ok(pagVencida.status === 200 && pagVencida.texto.includes("Suscríbete para ver sugerencias"), "B vencida - la pantalla pide suscribirse");
  const fichaEditar = await api(a, "GET", `/proyectos/${Q.id}?editar=departamento`);
  ok(fichaEditar.status === 200 && fichaEditar.texto.includes('id="campo-departamento"'), "?editar=departamento abre la edición en ese campo (RF-81)");
  const ficha = await api(a, "GET", `/proyectos/${P.id}`);
  ok(ficha.texto.includes("Atlántico · Barranquilla"), "la ficha muestra \"Atlántico · Barranquilla\"");
} finally {
  if (convocatorias.length) await svc.from("convocatorias").delete().in("id", convocatorias);
  for (const id of cuentas) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (categorias.length) await svc.from("categorias").delete().in("id", categorias);
  console.log("datos y cuentas de prueba borrados");
}
console.log(fallas ? `${fallas} FALLAS` : "TODO PASÓ");
process.exitCode = fallas ? 1 : 0;
