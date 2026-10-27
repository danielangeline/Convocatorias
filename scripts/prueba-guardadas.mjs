// Prueba de las convocatorias guardadas y del tipo y origen contra Supabase real
// (RF-102, RF-103, CU-45, RN-30, RN-33, RNF-30 · sesión 031).
//
//   npm run dev                                   (en otra terminal)
//   PRUEBA_URL=http://localhost:3001 node --env-file=.env.local scripts/prueba-guardadas.mjs
//
// Crea dos empresas y un consultor temporales, usa una convocatoria publicada
// real y borra las cuentas al terminar (las guardadas se van en cascada).
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
async function api(s, metodo, ruta, cuerpo, { origen = APP } = {}) {
  const headers = { ...(s ? { cookie: s.cookie() } : {}), ...(cuerpo ? { "content-type": "application/json" } : {}), ...(metodo !== "GET" ? { origin: origen } : {}) };
  const r = await fetch(APP + ruta, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined, redirect: "manual" });
  let json = null;
  try { json = JSON.parse(await r.text()); } catch { /* HTML */ }
  return { status: r.status, json };
}

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [];

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crear = async (rol, n) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${rol}${n}.guardadas.${sufijo}@example.com`, password: clave, email_confirm: true,
      user_metadata: { rol, nombre: `${rol} guardadas`, nombre_empresa: rol === "empresa" ? `Empresa ${n} ${sufijo}` : undefined, consentimiento_datos: true },
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

  const { data: vig } = await svc.from("convocatorias").select("id").eq("estado", "publicada").limit(1).single();
  const id = vig.id;

  // --- RF-102: el catálogo trae tipo y origen -----------------------------------------
  const cat = await api(a, "GET", "/api/convocatorias");
  const una = cat.json?.datos?.find?.((c) => c.id === id) ?? cat.json?.datos?.[0];
  ok(cat.status === 200 && ["fondo", "beneficio_tributario"].includes(una?.tipo) && ["publico", "privado", "cooperacion"].includes(una?.origen),
    `GET /api/convocatorias trae tipo y origen (${una?.tipo}, ${una?.origen})`);

  // --- Barreras ------------------------------------------------------------------------
  ok([307, 401].includes((await api(null, "GET", "/api/guardadas")).status), "visitante - GET /api/guardadas -> sin acceso");
  ok((await api(con, "GET", "/api/guardadas")).status === 403, "consultor - GET /api/guardadas -> 403");
  ok((await api(con, "POST", "/api/guardadas", { convocatoriaId: id })).status === 403, "consultor - POST /api/guardadas -> 403");
  ok((await api(a, "POST", "/api/guardadas", { convocatoriaId: id }, { origen: "https://otro.example" })).status === 403, "empresa desde otro origen - POST -> 403");
  ok((await api(a, "POST", "/api/guardadas", { convocatoriaId: "no-es-uuid" })).status === 400, "id inválido -> 400");
  ok((await api(a, "POST", "/api/guardadas", { convocatoriaId: crypto.randomUUID() })).status === 404, "convocatoria inexistente -> 404");

  // --- RF-103: guardar, aislar y quitar -------------------------------------------------
  ok((await api(a, "POST", "/api/guardadas", { convocatoriaId: id })).status === 200, "empresa A guarda -> 200");
  ok((await api(a, "POST", "/api/guardadas", { convocatoriaId: id })).status === 200, "guardar dos veces no falla (idempotente)");
  const listaA = await api(a, "GET", "/api/guardadas");
  ok(listaA.status === 200 && listaA.json?.datos?.length === 1 && listaA.json.datos[0] === id, "A ve su guardada");
  const listaB = await api(b, "GET", "/api/guardadas");
  ok(listaB.status === 200 && listaB.json?.datos?.length === 0, "B no ve las de A (RN-30)");

  await api(b, "DELETE", `/api/guardadas/${id}`);
  ok((await api(a, "GET", "/api/guardadas")).json?.datos?.length === 1, "B no puede quitar la de A");

  const { error: eAjena } = await b.cliente.from("convocatorias_guardadas").insert({ usuario_id: a.id, convocatoria_id: id });
  ok(!!eAjena, "RLS: B no inserta a nombre de A");
  const { data: directo } = await b.cliente.from("convocatorias_guardadas").select("*");
  ok((directo ?? []).length === 0, "RLS: B lee 0 filas directamente");
  const { error: eCon } = await con.cliente.from("convocatorias_guardadas").insert({ usuario_id: con.id, convocatoria_id: id });
  ok(!!eCon, "RLS: el consultor no guarda (solo empresas)");

  ok((await api(a, "DELETE", `/api/guardadas/${id}`)).status === 200, "A quita su guardada -> 200");
  ok((await api(a, "GET", "/api/guardadas")).json?.datos?.length === 0, "A ya no la tiene");

  // --- Pantallas nuevas (RNF-30) -------------------------------------------------------
  for (const ruta of ["/inicio", "/sugeridas", "/guardadas", "/ajustes"]) {
    ok((await api(a, "GET", ruta)).status === 200, `empresa - ${ruta} -> 200`);
    ok((await api(con, "GET", ruta)).status === 403, `consultor - ${ruta} -> 403`);
  }
} catch (e) {
  console.error("Error inesperado:", e);
  fallas++;
} finally {
  for (const id of cuentas) await svc.auth.admin.deleteUser(id);
  console.log(fallas === 0 ? "\nTODO EN VERDE" : `\n${fallas} FALLAS`);
  process.exit(fallas === 0 ? 0 : 1);
}
