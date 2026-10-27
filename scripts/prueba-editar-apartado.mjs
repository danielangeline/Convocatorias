// Prueba de «editar un apartado del proyecto con IA» contra Supabase real
// (RF-109, CU-47, RN-17, RN-30, RN-37, RNF-20 · sesión 031).
//
//   npx next build && IA_PROVEEDOR=prueba npx next start -p 3100   (o el preset prod-ia-prueba)
//   node --env-file=.env.local scripts/prueba-editar-apartado.mjs
//
// Crea dos empresas y un consultor temporales y los borra al terminar. Con el
// proveedor de prueba no se gasta saldo de OpenAI.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import crypto from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.PRUEBA_URL ?? "http://localhost:3100";
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
async function api(s, metodo, ruta, cuerpo, { origen = APP } = {}) {
  const headers = { ...(s ? { cookie: s.cookie() } : {}), ...(cuerpo ? { "content-type": "application/json" } : {}), ...(metodo !== "GET" ? { origin: origen } : {}) };
  const r = await fetch(APP + ruta, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined, redirect: "manual" });
  let json = null;
  try { json = JSON.parse(await r.text()); } catch { /* HTML */ }
  return { status: r.status, json };
}

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [];
const saldo = async (id) => {
  const { data } = await svc.from("suscripciones").select("creditos_usados_periodo, creditos_extra").eq("usuario_id", id).single();
  return data;
};

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crear = async (rol, n) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${rol}${n}.apartado.${sufijo}@example.com`, password: clave, email_confirm: true,
      user_metadata: { rol, nombre: `${rol} apartado`, nombre_empresa: rol === "empresa" ? `Empresa ${n} ${sufijo}` : undefined, consentimiento_datos: true },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    const s = sesion();
    const { error: e } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (e) throw e;
    s.id = data.user.id;
    return s;
  };
  const a = await crear("empresa", 1);
  const b = await crear("empresa", 2);
  const con = await crear("consultor", 1);

  const p = await api(a, "POST", "/api/proyectos", { nombre: `Planta ${sufijo}`, problema: "Pérdida de la pulpa de café", objetivoGeneral: "Producir abono" });
  const id = p.json?.datos?.id;
  ok(p.status === 200 && id, "empresa A crea su proyecto");
  const ruta = `/api/proyectos/${id}/editar-con-ia`;
  const cuerpo = { apartado: "objetivoGeneral", instruccion: "Hazlo más concreto", textoActual: "Producir abono" };

  // --- Barreras ------------------------------------------------------------------
  ok([307, 401].includes((await api(null, "POST", ruta, cuerpo)).status), "visitante -> sin acceso");
  ok((await api(con, "POST", ruta, cuerpo)).status === 403, "consultor -> 403");
  ok((await api(a, "POST", ruta, cuerpo, { origen: "https://otro.example" })).status === 403, "otro origen -> 403");
  ok((await api(b, "POST", ruta, cuerpo)).status === 404, "empresa B sobre el proyecto de A -> 404 (RN-30)");
  ok((await api(a, "POST", ruta, { ...cuerpo, apartado: "montoBuscado" })).status === 400, "apartado numérico -> 400 (sin IA)");
  ok((await api(a, "POST", ruta, { ...cuerpo, instruccion: "ok" })).status === 400, "petición muy corta -> 400");
  ok((await api(a, "POST", ruta, { ...cuerpo, instruccion: "x".repeat(2001) })).status === 400, "petición muy larga -> 400");
  ok((await api(a, "POST", `/api/proyectos/${crypto.randomUUID()}/editar-con-ia`, cuerpo)).status === 404, "proyecto inexistente -> 404");

  // --- RN-17: fallo sin cobro, éxito con su tarifa -------------------------------------
  const { data: tarifa } = await svc.from("tarifas_ia").select("creditos").eq("accion", "edicion_apartado").single();
  ok(tarifa?.creditos === 10, `tarifa «editar apartado» = 10 (${tarifa?.creditos})`);

  const antesFallo = await saldo(a.id);
  const fallo = await api(a, "POST", ruta, { ...cuerpo, textoActual: "FALLA_IA_PRUEBA" });
  const trasFallo = await saldo(a.id);
  ok(fallo.status === 502 && /No se descontó/.test(fallo.json?.error ?? ""), `fallo de la IA -> 502 sin cobro (${fallo.status})`);
  ok(trasFallo.creditos_usados_periodo === antesFallo.creditos_usados_periodo, "el fallo no descontó créditos");

  const exito = await api(a, "POST", ruta, cuerpo);
  const trasExito = await saldo(a.id);
  ok(exito.status === 200 && typeof exito.json?.datos?.texto === "string" && Array.isArray(exito.json?.datos?.faltantes),
    `éxito -> 200 con texto y faltantes (${exito.status})`);
  ok(trasExito.creditos_usados_periodo - trasFallo.creditos_usados_periodo === 10, "el éxito descontó exactamente 10");

  // RN-37: la propuesta no se guarda sola.
  const leido = await api(a, "GET", `/api/proyectos/${id}`);
  ok(leido.json?.datos?.objetivoGeneral === "Producir abono", "el proyecto no cambió hasta que la empresa guarde");

  const { data: consumos } = await svc.from("consumos_ia").select("tipo, exito, creditos").eq("usuario_id", a.id).eq("tipo", "edicion_apartado");
  ok(consumos?.length === 2 && consumos.some((c) => c.exito && c.creditos === 10) && consumos.some((c) => !c.exito && c.creditos === 0),
    "RF-52: un consumo exitoso (10) y uno fallido (0)");
} catch (e) {
  console.error("Error inesperado:", e);
  fallas++;
} finally {
  for (const id of cuentas) await svc.auth.admin.deleteUser(id);
  console.log(fallas === 0 ? "\nTODO EN VERDE" : `\n${fallas} FALLAS`);
  process.exit(fallas === 0 ? 0 : 1);
}
