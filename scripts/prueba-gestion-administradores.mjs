// Prueba de la gestión de administradores contra Supabase Auth real (CU-41, CU-42, RF-86, RF-87, RN-32).
//
//   npx next build && npx next start -p 3100      (en otra terminal)
//   node --env-file=.env.local scripts/prueba-gestion-administradores.mjs
//
// Recorre, con service_role, la misma secuencia que siguen los endpoints de
// lib/admin/administradores.ts, actuando en nombre del Propietario real:
// funciones SQL + API de administración de Auth. No envía correos: crea las
// cuentas con createUser en lugar de inviteUserByEmail, así que NO prueba el
// envío ni el enlace del correo, ni los endpoints con la sesión del Propietario.
// Borra al terminar las cuentas e invitaciones que crea.
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
const b32 = (s) => { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const ch of s) bits += a.indexOf(ch).toString(2).padStart(5, "0"); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); };
const desfase = new Date((await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })).headers.get("date")).getTime() - Date.now();
const totp = (sec) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor((Date.now() + desfase) / 30000))); const h = crypto.createHmac("sha1", b32(sec)).update(c).digest(); const k = h[h.length - 1] & 15; return String((h.readUInt32BE(k) & 0x7fffffff) % 1e6).padStart(6, "0"); };

const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
const P = propietario.id;
const correoActivo = "admin.activo.s009@example.com";
const correoCancelado = "admin.cancelado.s009@example.com";
const cuentas = [];
const invitaciones = [];

try {
  // --- Invitar: reglas de la base (RN-32, CU-41 3a/3b) ------------------------
  const rCuenta = await svc.rpc("crear_invitacion_admin", { p_propietario: P, p_correo: "empresa.s004@example.com", p_nombre: "X" });
  ok(rCuenta.error?.hint === "correo_con_cuenta", `invitar un correo con cuenta de empresa → correo_con_cuenta (${rCuenta.error?.hint})`);

  const invitar = async (correo, nombre) => {
    const { data: id, error } = await svc.rpc("crear_invitacion_admin", { p_propietario: P, p_correo: correo, p_nombre: nombre });
    if (id) invitaciones.push(id);
    ok(!error && id, `Propietario invita a ${correo} ${error?.message ?? ""}`);
    const clave = crypto.randomBytes(18).toString("base64url");
    const { data: creado, error: eCrear } = await svc.auth.admin.createUser({ email: correo, password: clave, email_confirm: true });
    if (creado?.user) cuentas.push(creado.user.id);
    const { error: eAcep } = await svc.rpc("aceptar_invitacion_admin", { p_invitacion: id, p_usuario: creado.user.id });
    ok(!eCrear && !eAcep, `cuenta de ${correo} creada y convertida ${eCrear?.message ?? ""} ${eAcep?.message ?? ""}`);
    return { id, usuario: creado.user.id, clave };
  };

  const activo = await invitar(correoActivo, "Admin activo s009");
  const rDuplicada = await svc.rpc("crear_invitacion_admin", { p_propietario: P, p_correo: correoActivo, p_nombre: "X" });
  ok(rDuplicada.error?.hint === "invitacion_pendiente", `invitar de nuevo con una pendiente → invitacion_pendiente (${rDuplicada.error?.hint})`);
  const rNoProp = await svc.rpc("crear_invitacion_admin", { p_propietario: activo.usuario, p_correo: "otro.s009@example.com", p_nombre: "X" });
  ok(rNoProp.error?.hint === "no_es_propietario", `invitar en nombre de otro administrador → no_es_propietario (${rNoProp.error?.hint})`);

  // --- Activar (CU-42): contraseña ya fijada, MFA y marca de aceptada ----------
  const adm = sesion();
  const { error: eEntrada } = await adm.cliente.auth.signInWithPassword({ email: correoActivo, password: activo.clave });
  ok(!eEntrada, `el invitado inicia sesión ${eEntrada?.message ?? ""}`);
  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  ok(!eMfa, "el invitado verifica su TOTP");
  const rRevPend = await svc.rpc("revocar_admin", { p_propietario: P, p_admin: activo.usuario });
  ok(rRevPend.error?.hint === "usar_cancelar", `revocar a quien no ha aceptado → usar_cancelar (${rRevPend.error?.hint})`);
  // Lo mismo que hace confirmarMfa (lib/acciones/auth.ts).
  await svc.from("invitaciones_admin").update({ estado: "aceptada", resuelta_at: new Date().toISOString() }).eq("usuario_id", activo.usuario).eq("estado", "pendiente");
  ok((await fetch(APP + "/admin", { redirect: "manual", headers: { cookie: adm.cookie() } })).status === 200, "administrador activado · /admin → 200");
  const refreshAntes = (await adm.cliente.auth.getSession()).data.session.refresh_token;

  // --- Revocar (RF-87) ----------------------------------------------------------
  const rSiMismo = await svc.rpc("revocar_admin", { p_propietario: P, p_admin: P });
  ok(rSiMismo.error?.hint === "revocarse_a_si_mismo", `el Propietario se revoca a sí mismo → revocarse_a_si_mismo (${rSiMismo.error?.hint})`);
  const { error: eRev } = await svc.rpc("revocar_admin", { p_propietario: P, p_admin: activo.usuario });
  ok(!eRev, `el Propietario revoca al administrador ${eRev?.message ?? ""}`);
  const r404 = await fetch(APP + "/admin", { redirect: "manual", headers: { cookie: adm.cookie() } });
  ok(r404.status === 404, `revocado · /admin con la misma cookie → 404 (${r404.status})`);
  const refresco = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ refresh_token: refreshAntes }) });
  ok(refresco.status >= 400, `revocado · su refresh token ya no renueva la sesión (${refresco.status})`);
  const { error: eBan } = await svc.auth.admin.updateUserById(activo.usuario, { ban_duration: "876000h" });
  ok(!eBan, `revocado · bloqueo en Auth ${eBan?.message ?? ""}`);
  const { error: eLoginBan } = await sesion().cliente.auth.signInWithPassword({ email: correoActivo, password: activo.clave });
  ok(eLoginBan !== null, `revocado · no puede volver a iniciar sesión (${eLoginBan?.code ?? "entró"})`);
  const rDoble = await svc.rpc("revocar_admin", { p_propietario: P, p_admin: activo.usuario });
  ok(rDoble.error?.hint === "no_revocable", `revocar dos veces → no_revocable (${rDoble.error?.hint})`);

  // --- Cancelar (CU-41 3b): marca y borra la cuenta sin activar -----------------
  const cancelado = await invitar(correoCancelado, "Admin cancelado s009");
  const { data: filas, error: eCan } = await svc.rpc("cancelar_invitacion_admin", { p_propietario: P, p_invitacion: cancelado.id });
  ok(!eCan && filas?.[0]?.usuario_id === cancelado.usuario && filas[0].estado === "cancelada", `cancelar devuelve la cuenta por borrar ${eCan?.message ?? ""}`);
  const { error: eBorrar } = await svc.auth.admin.deleteUser(cancelado.usuario);
  ok(!eBorrar, `la cuenta sin activar se borra en Auth pese a la invitación vinculada ${eBorrar?.message ?? ""}`);
  if (!eBorrar) cuentas.splice(cuentas.indexOf(cancelado.usuario), 1);
  const { data: invCancelada } = await svc.from("invitaciones_admin").select("estado, usuario_id").eq("id", cancelado.id).single();
  ok(invCancelada.estado === "cancelada" && invCancelada.usuario_id === null, "la invitación queda cancelada y sin cuenta vinculada");
  const { data: tieneCuenta } = await svc.rpc("correo_tiene_cuenta", { p_correo: correoCancelado });
  ok(tieneCuenta === false, "el correo cancelado queda libre para una nueva invitación");
} finally {
  for (const id of cuentas) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (invitaciones.length) await svc.from("invitaciones_admin").delete().in("id", invitaciones);
  console.log("cuentas e invitaciones de prueba borradas");
}
console.log(fallas ? `${fallas} FALLAS` : "TODO PASÓ");
process.exitCode = fallas ? 1 : 0;
