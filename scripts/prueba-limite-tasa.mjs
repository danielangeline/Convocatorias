// Límite de tasa sobre Upstash y su liberación desde el panel (CU-40 · RF-66,
// RF-67, RNF-27, RNF-33 · docs/05 §9.31 · sesión 030).
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-limite-tasa.mjs
//
// Usa Upstash de verdad. La IA se ejercita con explicaciones cortas, que el
// endpoint rechaza con 400 después de contar el intento: no gasta crédito ni
// saldo del proveedor. Crea una empresa, un consultor y un administrador por
// invitación con TOTP, temporales, y borra todo al terminar (también las
// claves de Upstash). El caso "Upstash caído" (RNF-33) se prueba aparte, con
// un servidor que apunta a una URL inválida: PRUEBA_UPSTASH_CAIDO=1.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import crypto from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.PRUEBA_URL ?? "http://localhost:3000";
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const upstash = async (comandos) => {
  const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }, body: JSON.stringify(comandos),
  });
  return r.json();
};
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
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* HTML */ }
  return { status: r.status, json, reintentar: r.headers.get("retry-after") };
}
const b32 = (s) => { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const ch of s) bits += a.indexOf(ch).toString(2).padStart(5, "0"); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); };
const desfase = new Date((await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })).headers.get("date")).getTime() - Date.now();
const totp = (sec) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor((Date.now() + desfase) / 30000))); const h = crypto.createHmac("sha1", b32(sec)).update(c).digest(); const k = h[h.length - 1] & 15; return String((h.readUInt32BE(k) & 0x7fffffff) % 1e6).padStart(6, "0"); };

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], invitaciones = [];
const CORTA = { explicacion: "corta" };

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre, extra = {}) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.lt.${sufijo}@example.com`, password: clave, email_confirm: true,
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
  const empresa = await crearCuenta("empresa", "empresa", { nombre_empresa: `Empresa ${sufijo}` });

  if (process.env.PRUEBA_UPSTASH_CAIDO === "1") {
    // RNF-33: el servidor apunta a una URL de Upstash que no responde.
    const r = await api(empresa, "POST", "/api/proyectos/estructurar", CORTA);
    ok(r.status === 503 && /en este momento/.test(r.json?.error ?? ""), `RNF-33: con Upstash caído, la IA responde 503 y no deja pasar (${r.status})`);
    const { data: c } = await svc.from("suscripciones").select("creditos_usados_periodo").eq("usuario_id", empresa.id).single();
    ok(c.creditos_usados_periodo === 0, "RNF-33: y no se reservó ni cobró nada");
  } else {
    // --- RF-66: 30 intentos de IA en la ventana; el 31 se bloquea -------------------------------
    const estados = [];
    for (let i = 0; i < 30; i++) estados.push((await api(empresa, "POST", "/api/proyectos/estructurar", CORTA)).status);
    ok(estados.every((s) => s === 400), `RF-66: los 30 primeros pasan el límite (los rechaza la validación: ${[...new Set(estados)].join("/")})`);
    const bloqueado = await api(empresa, "POST", "/api/proyectos/estructurar", CORTA);
    ok(bloqueado.status === 429 && Number(bloqueado.reintentar) > 0 && /demasiados intentos/i.test(bloqueado.json?.error ?? ""),
      `RF-66: el 31 responde 429 con Retry-After (${bloqueado.status}, ${bloqueado.reintentar} s)`);
    const otroEndpoint = await api(empresa, "POST", "/api/documentos/generar", { proyectoId: crypto.randomUUID(), convocatoriaId: crypto.randomUUID() });
    ok(otroEndpoint.status === 429, `RF-66: el límite es por usuario en toda la IA, también al generar (${otroEndpoint.status})`);
    const { data: c } = await svc.from("suscripciones").select("creditos_usados_periodo").eq("usuario_id", empresa.id).single();
    ok(c.creditos_usados_periodo === 0, "RF-66: es independiente del cupo: no se cobró nada");
    const { data: eventos } = await svc.from("eventos_seguridad").select("id, bloqueado_hasta, clave_limite, ruta").eq("usuario_id", empresa.id).eq("tipo", "limite_tasa");
    ok(eventos?.length === 1 && new Date(eventos[0].bloqueado_hasta) > new Date() && eventos[0].clave_limite?.startsWith(`lt:ia:usuario:${empresa.id}`),
      `RF-66: un solo evento del bloqueo, con expiración y la clave del contador (${eventos?.length})`);

    // --- RF-67: liberar desde el panel ---------------------------------------------------------
    const consultor = await crearCuenta("consultor", "consultor");
    const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
    const correoAdmin = `admin.lt.${sufijo}@example.com`;
    const { data: invId } = await svc.rpc("crear_invitacion_admin", { p_propietario: propietario.id, p_correo: correoAdmin, p_nombre: "Admin límite" });
    invitaciones.push(invId);
    const { data: uAdmin } = await svc.auth.admin.createUser({ email: correoAdmin, password: clave, email_confirm: true });
    cuentas.push(uAdmin.user.id);
    await svc.rpc("aceptar_invitacion_admin", { p_invitacion: invId, p_usuario: uAdmin.user.id });
    const adm = sesion();
    await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: clave });

    const ruta = `/api/admin/seguridad/${eventos[0].id}/liberar`;
    ok((await api(empresa, "POST", ruta, {})).status === 404 && (await api(consultor, "POST", ruta, {})).status === 404, "RF-85: empresa y consultor -> 404");
    const sinMfa = await api(adm, "POST", ruta, {});
    ok(sinMfa.status === 307, `RNF-28: administrador sin MFA -> /mfa (${sinMfa.status})`);
    const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
    await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
    const liberar = await api(adm, "POST", ruta, {});
    ok(liberar.status === 200, `RF-67: el administrador con MFA libera el bloqueo (${liberar.status})`);
    const { data: ev } = await svc.from("eventos_seguridad").select("bloqueado_hasta, liberado_por").eq("id", eventos[0].id).single();
    ok(new Date(ev.bloqueado_hasta) <= new Date() && ev.liberado_por === uAdmin.user.id, "RF-67: el evento queda vencido y con quién lo liberó");
    const [{ result: existe }] = await upstash([["EXISTS", eventos[0].clave_limite]]);
    ok(existe === 0, "RF-67: el contador ya no está en Upstash");
    const otraVez = await api(empresa, "POST", "/api/proyectos/estructurar", CORTA);
    ok(otraVez.status === 400, `RF-67: la empresa puede volver a intentarlo (${otraVez.status})`);
    ok((await api(adm, "POST", ruta, {})).status === 404, "RF-67: liberar dos veces -> 404 (ya no está activo)");
  }
} catch (e) {
  console.error("ERROR", e);
  fallas++;
} finally {
  for (const id of cuentas) {
    const ventana = Math.floor(Date.now() / 1000 / 600);
    await upstash([["DEL", `lt:ia:usuario:${id}:${ventana}`], ["DEL", `lt:ia:usuario:${id}:${ventana - 1}`]]).catch(() => {});
  }
  await svc.from("eventos_seguridad").delete().in("usuario_id", cuentas);
  await svc.from("consumos_ia").delete().in("usuario_id", cuentas);
  for (const id of [...cuentas].reverse()) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (invitaciones.length) await svc.from("invitaciones_admin").delete().in("id", invitaciones);
  const { count } = await svc.from("perfiles").select("id", { count: "exact", head: true }).in("id", cuentas);
  console.log(`\nCuentas temporales sobrantes: ${count ?? "?"}`);
  console.log(fallas === 0 ? "TODAS LAS COMPROBACIONES PASARON" : `${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
