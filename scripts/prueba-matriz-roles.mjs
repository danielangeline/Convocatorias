// Prueba de la matriz rol × ruta contra la aplicación en marcha (RNF-30, RF-85, RF-87, RNF-28, RNF-35, Hito 1).
//
//   npx next build && npx next start -p 3100      (en otra terminal)
//   node --env-file=.env.local scripts/prueba-matriz-roles.mjs
//
// Usa las cuentas de prueba empresa.s004 y consultor.s004 (les asigna una contraseña
// aleatoria con service_role) y crea un administrador temporal por invitación, que
// borra al terminar junto con su invitación.
// Deja eventos `acceso_denegado` reales en eventos_seguridad: es lo que se prueba.
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
async function pedir(ruta, cookie, extra = {}) {
  const r = await fetch(APP + ruta, { redirect: "manual", headers: { ...(cookie ? { cookie } : {}), ...extra } });
  return { status: r.status, destino: r.headers.get("location"), cuerpo: await r.text() };
}
const b32 = (s) => { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const ch of s) bits += a.indexOf(ch).toString(2).padStart(5, "0"); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); };
const desfase = new Date((await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })).headers.get("date")).getTime() - Date.now();
const totp = (sec) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor((Date.now() + desfase) / 30000))); const h = crypto.createHmac("sha1", b32(sec)).update(c).digest(); const k = h[h.length - 1] & 15; return String((h.readUInt32BE(k) & 0x7fffffff) % 1e6).padStart(6, "0"); };

const contarDenegados = async () => (await svc.from("eventos_seguridad").select("*", { count: "exact", head: true }).eq("tipo", "acceso_denegado")).count;
const inicio = await contarDenegados();

// --- Sesiones -------------------------------------------------------------
const { data: lista } = await svc.auth.admin.listUsers({ perPage: 1000 });
const claveEmp = crypto.randomBytes(18).toString("base64url");
await svc.auth.admin.updateUserById(lista.users.find((u) => u.email === "empresa.s004@example.com").id, { password: claveEmp });
const emp = sesion(); const eEmp = (await emp.cliente.auth.signInWithPassword({ email: "empresa.s004@example.com", password: claveEmp })).error; ok(!eEmp, `sesión empresa ${eEmp?.message ?? ""}`);
const claveCon = crypto.randomBytes(18).toString("base64url");
await svc.auth.admin.updateUserById(lista.users.find((u) => u.email === "consultor.s004@example.com").id, { password: claveCon });
const con = sesion(); ok(!(await con.cliente.auth.signInWithPassword({ email: "consultor.s004@example.com", password: claveCon })).error, "sesión consultor");

// Administrador temporal por la vía real de invitación (§9.12).
const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
const correoAdmin = "admin.temporal.s007@example.com";
// Por la vía real de invitación (docs/05 §9.12, rediseñada en la sesión 008):
// invitación → cuenta en Auth (nace empresa) → aceptar_invitacion_admin con service_role.
const { data: inv } = await svc.from("invitaciones_admin").insert({ correo: correoAdmin, nombre: "Admin temporal", invitado_por: propietario.id }).select("id").single();
const claveAdmin = crypto.randomBytes(18).toString("base64url");
const { data: creado, error: eCreado } = await svc.auth.admin.createUser({ email: correoAdmin, password: claveAdmin, email_confirm: true });
const { error: eAcep } = await svc.rpc("aceptar_invitacion_admin", { p_invitacion: inv.id, p_usuario: creado.user.id });
ok(!eCreado && !eAcep, `administrador temporal creado por invitación ${eCreado?.message ?? ""} ${eAcep?.message ?? ""}`);
const adm = sesion();
const eAdm = (await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: claveAdmin })).error;
ok(!eAdm, `sesión admin temporal ${eAdm ? eAdm.code + " " + eAdm.message : ""}`);
const cookieAal1 = adm.cookie();

try {
  // --- Anónimo --------------------------------------------------------------
  const inventada = await pedir("/ruta-inventada-s007");
  ok(inventada.status === 404, "anónimo · ruta inventada → 404");
  ok((await pedir("/")).status === 200, "anónimo · / → 200");
  ok((await pedir("/login")).status === 200, "anónimo · /login → 200");
  const r1 = await pedir("/convocatorias"); ok(r1.status === 307 && r1.destino?.endsWith("/login"), "anónimo · /convocatorias → /login");
  for (const ruta of ["/admin", "/admin/seguridad", "/admin/administradores", "/mfa", "/api/admin/administradores", "/api/admin/invitaciones", "/acceso-denegado"]) {
    const r = await pedir(ruta);
    ok(r.status === 404, `anónimo · ${ruta} → 404`);
    ok(r.cuerpo === inventada.cuerpo, `anónimo · ${ruta}: misma página que la ruta inventada (RNF-35)`);
  }

  // --- Empresa --------------------------------------------------------------
  const inventadaEmp = await pedir("/ruta-inventada-s007", emp.cookie());
  for (const [ruta, esperado] of [["/convocatorias", 200], ["/convocatorias/conv-1/generar", 200], ["/documentos", 200], ["/consultor/perfil", 403]]) {
    ok((await pedir(ruta, emp.cookie())).status === esperado, `empresa · ${ruta} → ${esperado}`);
  }
  for (const ruta of ["/admin", "/admin/planes", "/admin/administradores", "/mfa", "/api/admin/administradores"]) {
    const r = await pedir(ruta, emp.cookie());
    ok(r.status === 404 && r.cuerpo === inventadaEmp.cuerpo, `empresa · ${ruta} → 404 idéntico a ruta inventada (RF-85)`);
  }

  // --- Consultor (Hito 1) ---------------------------------------------------
  const inventadaCon = await pedir("/ruta-inventada-s007", con.cookie());
  for (const [ruta, esperado] of [["/consultor/perfil", 200], ["/convocatorias/conv-1/generar", 403], ["/documentos", 403], ["/convocatorias", 403]]) {
    ok((await pedir(ruta, con.cookie())).status === esperado, `consultor · ${ruta} → ${esperado}`);
  }
  let rsc = await pedir("/convocatorias/conv-1/generar", con.cookie(), { RSC: "1" });
  if (rsc.status === 307 && rsc.destino) rsc = await pedir(new URL(rsc.destino, APP).pathname + new URL(rsc.destino, APP).search, con.cookie(), { RSC: "1" });
  ok(rsc.status === 403, `consultor · petición RSC a /convocatorias/[id]/generar → 403 (${rsc.status} ${rsc.destino ?? ""})`);
  const contarDoc = async () => (await svc.from("eventos_seguridad").select("*", { count: "exact", head: true }).eq("tipo", "acceso_denegado").eq("ruta", "/documentos")).count;
  const antesAccion = await contarDoc();
  const accion = await fetch(APP + "/documentos", { method: "POST", redirect: "manual", headers: { cookie: con.cookie(), "next-action": "0".repeat(40), "content-type": "text/plain" }, body: "[]" });
  const evAccion = (await contarDoc()) - antesAccion;
  ok(accion.status !== 200 && evAccion === 1, `consultor · Server Action sobre /documentos: el proxy la corta y registra acceso_denegado (${accion.status}, eventos ${evAccion})`);
  const conAdmin = await pedir("/admin", con.cookie());
  ok(conAdmin.status === 404 && conAdmin.cuerpo === inventadaCon.cuerpo, "consultor · /admin → 404 idéntico a ruta inventada (Hito 1)");

  // --- Administrador --------------------------------------------------------
  const a1 = await pedir("/admin", cookieAal1);
  ok(a1.status === 307 && a1.destino?.endsWith("/mfa"), `admin sin MFA · /admin → /mfa (RNF-28) (${a1.status} ${a1.destino ?? ""})`);
  ok((await pedir("/mfa", cookieAal1)).status === 200, "admin sin MFA · /mfa → 200");
  ok((await pedir("/convocatorias", cookieAal1)).status === 403, "admin · /convocatorias → 403");

  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  ok(!eMfa, "admin temporal verifica TOTP");
  for (const [ruta, esperado] of [["/admin", 200], ["/admin/seguridad", 200], ["/consultor/perfil", 403]]) {
    ok((await pedir(ruta, adm.cookie())).status === esperado, `admin con MFA · ${ruta} → ${esperado}`);
  }
  const adminHtml = await pedir("/admin", adm.cookie());
  ok(/noindex/.test(adminHtml.cuerpo), "admin · el panel lleva noindex");

  // RF-86: la gestión de administradores es solo del Propietario; a otro
  // administrador con MFA le responde lo mismo que una ruta inexistente.
  const inventadaAdm = await pedir("/admin/ruta-inventada-s009", adm.cookie());
  for (const ruta of ["/admin/administradores", "/api/admin/administradores"]) {
    const r = await pedir(ruta, adm.cookie());
    ok(r.status === 404 && r.cuerpo === inventadaAdm.cuerpo, `admin no Propietario · ${ruta} → 404 idéntico a ruta inventada (RF-86) (${r.status})`);
  }
  ok(adminHtml.cuerpo.includes('href="/admin/seguridad"') && !adminHtml.cuerpo.includes('href="/admin/administradores"'), "admin no Propietario · el menú enlaza el panel pero no la gestión de administradores");
  const correoIntruso = "intruso.s009@example.com";
  const post = (ruta, cuerpo) => fetch(APP + ruta, { method: "POST", redirect: "manual", headers: { cookie: adm.cookie(), origin: APP, "content-type": "application/json" }, body: JSON.stringify(cuerpo ?? {}) });
  const rInv = await post("/api/admin/administradores/invitar", { correo: correoIntruso, nombre: "Intruso" });
  const { count: invIntruso } = await svc.from("invitaciones_admin").select("*", { count: "exact", head: true }).eq("correo", correoIntruso);
  ok(rInv.status === 404 && invIntruso === 0, `admin no Propietario · POST invitar → 404 y ninguna invitación creada (${rInv.status}, ${invIntruso})`);
  const rRev = await post(`/api/admin/administradores/${propietario.id}/revocar`);
  const { data: propTrasIntento } = await svc.from("perfiles").select("admin_revocado_at").eq("id", propietario.id).single();
  ok(rRev.status === 404 && propTrasIntento.admin_revocado_at === null, `admin no Propietario · POST revocar al Propietario → 404 y sin efecto (${rRev.status})`);
  const rCan = await post(`/api/admin/invitaciones/${inv.id}/cancelar`);
  const { data: invTrasIntento } = await svc.from("invitaciones_admin").select("estado").eq("id", inv.id).single();
  ok(rCan.status === 404 && invTrasIntento.estado === "pendiente", `admin no Propietario · POST cancelar su propia invitación → 404 y sin efecto (${rCan.status})`);
  const rEmp = await fetch(APP + `/api/admin/invitaciones/${inv.id}/reenviar`, { method: "POST", redirect: "manual", headers: { cookie: emp.cookie(), origin: APP } });
  ok(rEmp.status === 404, `empresa · POST reenviar → 404 (${rEmp.status})`);

  // Invitación vencida sin activar: con la misma cookie, el panel desaparece (§9.12).
  await svc.from("invitaciones_admin").update({ creada_at: new Date(Date.now() - 4 * 864e5).toISOString(), expira_at: new Date(Date.now() - 864e5).toISOString() }).eq("id", inv.id);
  const venc = await pedir("/admin", adm.cookie());
  const vencMfa = await pedir("/mfa", adm.cookie());
  ok(venc.status === 404 && vencMfa.status === 404, `admin con invitación vencida · /admin y /mfa → 404 (${venc.status}, ${vencMfa.status})`);
  await svc.from("invitaciones_admin").update({ estado: "aceptada", resuelta_at: new Date().toISOString() }).eq("id", inv.id);
  ok((await pedir("/admin", adm.cookie())).status === 200, "admin con invitación aceptada · /admin → 200");

  // Revocación: con la misma cookie, el panel desaparece (RF-87).
  await svc.from("perfiles").update({ admin_revocado_at: new Date().toISOString(), admin_revocado_por: propietario.id }).eq("id", creado.user.id);
  const rev = await pedir("/admin", adm.cookie());
  ok(rev.status === 404, "admin revocado · /admin → 404 con la misma sesión (RF-87)");

  // --- RNF-35: nada servido a no administradores nombra el panel -------------
  const vistos = new Set();
  let menciones = [];
  for (const [cookie, rutas] of [[undefined, ["/", "/login", "/registro", "/ruta-inventada-s007"]], [emp.cookie(), ["/convocatorias", "/convocatorias/conv-1/generar", "/documentos", "/suscripcion", "/proyectos"]], [con.cookie(), ["/consultor/perfil", "/consultor/encargos", "/convocatorias"]]]) {
    for (const ruta of rutas) {
      const { cuerpo } = await pedir(ruta, cookie);
      if (/\/admin|\/mfa\b/.test(cuerpo)) menciones.push(`HTML ${ruta}`);
      for (const [, src] of cuerpo.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)) {
        if (vistos.has(src)) continue;
        vistos.add(src);
        const js = await (await fetch(APP + src)).text();
        if (/\/admin|\/mfa\b/.test(js)) menciones.push(`JS ${src}`);
      }
    }
  }
  ok(menciones.length === 0, `RNF-35 · ${vistos.size} archivos JS y sus HTML sin mencionar el panel${menciones.length ? ": " + menciones.join(", ") : ""}`);

  const count = (await contarDenegados()) - inicio;
  ok(count >= 15, `eventos acceso_denegado registrados durante la prueba: ${count}`);
} finally {
  await svc.from("invitaciones_admin").delete().eq("id", inv.id);
  const { error } = await svc.auth.admin.deleteUser(creado.user.id);
  console.log(error ? `No se pudo borrar el admin temporal: ${error.message}` : "admin temporal borrado");
}
console.log(fallas ? `${fallas} FALLAS` : "TODO PASÓ");
process.exitCode = fallas ? 1 : 0;
