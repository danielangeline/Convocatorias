// Autorización de datos de las empresas anteriores a la casilla del registro
// (RF-88) y eventos de seguridad reales en el panel (CU-39, RF-65). Sesión 030.
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-consentimiento-y-seguridad.mjs
//
// Crea una empresa, un consultor y un administrador por invitación con TOTP,
// temporales, y los borra al terminar con sus eventos.
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
async function api(s, metodo, ruta, { origen = APP } = {}) {
  const headers = { "content-type": "application/json" };
  if (s) headers.cookie = s.cookie();
  if (origen) headers.origin = origen;
  const r = await fetch(APP + ruta, { method: metodo, headers, redirect: "manual", body: metodo === "GET" ? undefined : "{}" });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* HTML */ }
  return { status: r.status, json, texto, destino: r.headers.get("location") };
}
const b32 = (s) => { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const ch of s) bits += a.indexOf(ch).toString(2).padStart(5, "0"); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); };
const desfase = new Date((await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })).headers.get("date")).getTime() - Date.now();
const totp = (sec) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor((Date.now() + desfase) / 30000))); const h = crypto.createHmac("sha1", b32(sec)).update(c).digest(); const k = h[h.length - 1] & 15; return String((h.readUInt32BE(k) & 0x7fffffff) % 1e6).padStart(6, "0"); };

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], invitaciones = [];
const AVISO = "Falta tu autorización de datos personales";

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre, extra = {}) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.cys.${sufijo}@example.com`, password: clave, email_confirm: true,
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
  const consultor = await crearCuenta("consultor", "consultor");

  // --- RF-88: empresa anterior a la casilla ------------------------------------------------
  const conConsentimiento = await api(empresa, "GET", "/proyectos");
  ok(conConsentimiento.status === 200 && !conConsentimiento.texto.includes(AVISO), "RF-88: con autorización, el portal no muestra el aviso");
  await svc.from("perfiles").update({ consentimiento_datos_at: null }).eq("id", empresa.id);
  const sinConsentimiento = await api(empresa, "GET", "/proyectos");
  ok(sinConsentimiento.status === 200 && sinConsentimiento.texto.includes(AVISO), "RF-88: sin autorización, el portal muestra el aviso");
  ok((await api(consultor, "POST", "/api/cuenta/consentimiento")).status === 403, "RNF-30: el consultor no usa el endpoint de la empresa -> 403");
  ok((await api(empresa, "POST", "/api/cuenta/consentimiento", { origen: "https://otro.example" })).status === 403, "RNF-30: desde otro origen -> 403");
  const { data: sigueNula } = await svc.from("perfiles").select("consentimiento_datos_at").eq("id", empresa.id).single();
  ok(sigueNula.consentimiento_datos_at === null, "RF-88: los rechazos no marcaron nada");
  const acepta = await api(empresa, "POST", "/api/cuenta/consentimiento");
  const { data: marcada } = await svc.from("perfiles").select("consentimiento_datos_at").eq("id", empresa.id).single();
  ok(acepta.status === 200 && marcada.consentimiento_datos_at !== null, `RF-88: la empresa acepta y queda la fecha (${acepta.status})`);
  ok(!(await api(empresa, "GET", "/proyectos")).texto.includes(AVISO), "RF-88: después ya no ve el aviso");
  const otra = await api(empresa, "POST", "/api/cuenta/consentimiento");
  const { data: igual } = await svc.from("perfiles").select("consentimiento_datos_at").eq("id", empresa.id).single();
  ok(otra.status === 200 && igual.consentimiento_datos_at === marcada.consentimiento_datos_at, "RF-88: aceptar otra vez no cambia la fecha original");

  // --- RF-65: eventos reales en el panel ----------------------------------------------------
  const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
  const correoAdmin = `admin.cys.${sufijo}@example.com`;
  const { data: invId } = await svc.rpc("crear_invitacion_admin", { p_propietario: propietario.id, p_correo: correoAdmin, p_nombre: "Admin seguridad" });
  invitaciones.push(invId);
  const { data: uAdmin } = await svc.auth.admin.createUser({ email: correoAdmin, password: clave, email_confirm: true });
  cuentas.push(uAdmin.user.id);
  await svc.rpc("aceptar_invitacion_admin", { p_invitacion: invId, p_usuario: uAdmin.user.id });
  const adm = sesion();
  await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: clave });
  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  ok(!eMfa, "administrador verifica su TOTP (aal2)");

  // Un evento real y reconocible: la empresa intenta entrar al panel.
  const rutaMarcada = `/admin/seguridad-${sufijo}`;
  await svc.from("eventos_seguridad").insert({ tipo: "acceso_denegado", usuario_id: empresa.id, ruta: rutaMarcada, detalle: `prueba ${sufijo}` });
  const pantalla = await api(adm, "GET", "/admin/seguridad");
  ok(pantalla.status === 200 && pantalla.texto.includes(rutaMarcada) && pantalla.texto.includes(`Empresa ${sufijo}`),
    `RF-65: el panel muestra el evento real con la empresa que lo originó (${pantalla.status})`);
  ok(!pantalla.texto.includes("190.85.12.44"), "RF-65: ya no muestra los datos de ejemplo del store");
  for (const [nombre, s] of [["empresa", empresa], ["consultor", consultor]]) {
    const r = await api(s, "GET", "/admin/seguridad");
    ok(r.status === 404 && !r.texto.includes(rutaMarcada), `RF-85: ${nombre} -> 404 y no ve eventos (${r.status})`);
  }
} catch (e) {
  console.error("ERROR", e);
  fallas++;
} finally {
  await svc.from("eventos_seguridad").delete().in("usuario_id", cuentas);
  await svc.from("eventos_seguridad").delete().like("ruta", `%${sufijo}%`);
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
