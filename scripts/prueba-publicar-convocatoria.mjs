// Prueba de publicar y despublicar una convocatoria (RF-09, CU-05, RN-01, RN-03, RNF-11, RNF-29).
//
//   npm run dev                                   (en otra terminal; o PRUEBA_URL=http://localhost:3100 con next start)
//   node --env-file=.env.local scripts/prueba-publicar-convocatoria.mjs
//
// Igual que las otras: crea sus propias cuentas temporales —un administrador por
// la vía real de invitación, con MFA verificado, y una empresa— y borra todo al
// terminar.
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
const b32 = (s) => { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const ch of s) bits += a.indexOf(ch).toString(2).padStart(5, "0"); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); };
const desfase = new Date((await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })).headers.get("date")).getTime() - Date.now();
const totp = (sec) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor((Date.now() + desfase) / 30000))); const h = crypto.createHmac("sha1", b32(sec)).update(c).digest(); const k = h[h.length - 1] & 15; return String((h.readUInt32BE(k) & 0x7fffffff) % 1e6).padStart(6, "0"); };

async function api(s, metodo, ruta, cuerpo, { origen = APP } = {}) {
  const headers = { "content-type": "application/json" };
  if (s) headers.cookie = s.cookie();
  if (origen) headers.origin = origen;
  const r = await fetch(APP + ruta, { method: metodo, headers, redirect: "manual", body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  return { status: r.status, json: await r.json().catch(() => null) };
}

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], invitaciones = [], fuentes = [], convocatorias = [];
const enDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

try {
  // --- Cuentas temporales ---------------------------------------------------------
  const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
  const correoAdmin = `admin.publicar.${sufijo}@example.com`, correoEmpresa = `empresa.publicar.${sufijo}@example.com`;
  const clave = crypto.randomBytes(18).toString("base64url");

  const { data: invId } = await svc.rpc("crear_invitacion_admin", { p_propietario: propietario.id, p_correo: correoAdmin, p_nombre: "Admin publicar" });
  if (invId) invitaciones.push(invId);
  const { data: uAdmin } = await svc.auth.admin.createUser({ email: correoAdmin, password: clave, email_confirm: true });
  cuentas.push(uAdmin.user.id);
  await svc.rpc("aceptar_invitacion_admin", { p_invitacion: invId, p_usuario: uAdmin.user.id });
  const { data: uEmp } = await svc.auth.admin.createUser({ email: correoEmpresa, password: clave, email_confirm: true, user_metadata: { rol: "empresa", nombre: "Empresa publicar" } });
  cuentas.push(uEmp.user.id);

  const adm = sesion(), emp = sesion();
  await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: clave });
  await emp.cliente.auth.signInWithPassword({ email: correoEmpresa, password: clave });
  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  await svc.from("invitaciones_admin").update({ estado: "aceptada", resuelta_at: new Date().toISOString() }).eq("id", invId);
  ok(!eMfa, `administrador verifica su TOTP (aal2) ${eMfa?.message ?? ""}`);

  const rFuente = await api(adm, "POST", "/api/admin/fuentes", { nombre: `Fuente publicar ${sufijo}` });
  fuentes.push(rFuente.json.datos.id);
  const crear = async (nombre, cierre) => {
    const r = await api(adm, "POST", "/api/admin/convocatorias", { fuenteId: rFuente.json.datos.id, nombre, entidadConvocante: "Entidad", fechaCierre: cierre });
    convocatorias.push(r.json.datos.id);
    return r.json.datos.id;
  };
  const ficha = (extra = {}) => ({
    nombre: `Convocatoria publicar ${sufijo}`, entidadConvocante: "Entidad", fechaCierre: enDias(30),
    fuenteId: rFuente.json.datos.id, descripcion: "", ubicacion: "", urlPostulacion: "", montoMin: "", montoMax: "", fechaApertura: "",
    categorias: [], requisitos: [], ...extra,
  });
  const requisito = [{ descripcion: "Cámara de comercio", tipo: "documento", obligatorio: true }];

  const convId = await crear(`Convocatoria publicar ${sufijo}`, enDias(30));
  const pub = `/api/admin/convocatorias/${convId}/publicar`, despub = `/api/admin/convocatorias/${convId}/despublicar`;

  // --- RF-85 · publicar no existe para quien no es administrador --------------------
  ok((await api(null, "POST", pub, {})).status === 404, "anónimo · publicar → 404");
  ok((await api(emp, "POST", pub, {})).status === 404, "empresa · publicar → 404");
  ok((await api(emp, "POST", despub, {})).status === 404, "empresa · despublicar → 404");
  ok((await api(adm, "POST", pub, {}, { origen: "https://otro.example" })).status === 403, "administrador desde otro origen · publicar → 403");
  ok((await api(adm, "POST", `/api/admin/convocatorias/${crypto.randomUUID()}/publicar`, {})).status === 404, "publicar una convocatoria inexistente → 404");
  ok((await api(adm, "POST", "/api/admin/convocatorias/no-es-uuid/publicar", {})).status === 404, "id que no es uuid → 404");

  // --- RN-01 · 400 con la lista de lo que falta ------------------------------------
  const sinNada = await api(adm, "POST", pub, {});
  ok(sinNada.status === 400 && /enlace oficial/.test(sinNada.json.error) && /requisito/.test(sinNada.json.error),
    `sin enlace ni requisitos → 400 nombrando los dos ("${sinNada.json?.error}")`);

  await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, ficha({ requisitos: requisito }));
  const soloFaltaEnlace = await api(adm, "POST", pub, {});
  ok(soloFaltaEnlace.status === 400 && /enlace oficial/.test(soloFaltaEnlace.json.error) && !/requisito/.test(soloFaltaEnlace.json.error),
    `con requisitos y sin enlace → 400 nombrando solo el enlace ("${soloFaltaEnlace.json?.error}")`);

  await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, ficha({ urlPostulacion: "https://entidad.gov.co/x" }));
  const soloFaltaReq = await api(adm, "POST", pub, {});
  ok(soloFaltaReq.status === 400 && /requisito/.test(soloFaltaReq.json.error) && !/enlace oficial/.test(soloFaltaReq.json.error),
    `con enlace y sin requisitos → 400 nombrando solo el requisito ("${soloFaltaReq.json?.error}")`);

  // Que siga en borrador después de cada intento fallido.
  const tras = await api(adm, "GET", `/api/admin/convocatorias/${convId}`);
  ok(tras.json.datos.estado === "borrador", `tras los rechazos sigue en borrador (${tras.json.datos.estado})`);

  // --- Publicar (CU-05) ---------------------------------------------------------------
  await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, ficha({ urlPostulacion: "https://entidad.gov.co/x", requisitos: requisito }));
  const rPub = await api(adm, "POST", pub, {});
  ok(rPub.status === 200 && rPub.json.datos.estado === "publicada", `publicar con todo lo exigido → 200 (${rPub.status}, ${rPub.json?.datos?.estado})`);
  ok(Boolean(rPub.json.datos.publicadaAt), "queda registrado cuándo se publicó");

  // RNF-11: queda registrado quién publicó.
  const { data: fila } = await svc.from("convocatorias").select("publicado_por, publicada_at").eq("id", convId).single();
  ok(fila.publicado_por === uAdmin.user.id, "queda registrado quién publicó (RNF-11)");

  // RN-01 · los adjuntos NO se exigen (v6, sesión 012): se publicó sin ninguno.
  ok(rPub.json.datos.documentos.length === 0, "se publicó sin ningún documento adjunto (RN-01, v6)");

  ok((await api(adm, "POST", pub, {})).status === 409, "publicar dos veces → 409");

  // --- La regla se mantiene al editar (RN-01) -------------------------------------------
  const quitarEnlace = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, ficha({ urlPostulacion: "", requisitos: requisito }));
  ok(quitarEnlace.status === 409, `quitarle el enlace a una publicada → 409 (${quitarEnlace.status})`);
  const quitarReq = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, ficha({ urlPostulacion: "https://entidad.gov.co/x", requisitos: [] }));
  ok(quitarReq.status === 409, `quitarle los requisitos a una publicada → 409 (${quitarReq.status})`);

  // --- Despublicar (CU-05 3b) -----------------------------------------------------------
  const rDespub = await api(adm, "POST", despub, {});
  ok(rDespub.status === 200 && rDespub.json.datos.estado === "despublicada", `despublicar → 200 (${rDespub.json?.datos?.estado})`);
  ok(Boolean(rDespub.json.datos.publicadaAt), "despublicar conserva el rastro de que estuvo publicada (RN-07)");
  ok((await api(adm, "POST", despub, {})).status === 409, "despublicar dos veces → 409");
  const rRepub = await api(adm, "POST", pub, {});
  ok(rRepub.status === 200 && rRepub.json.datos.estado === "publicada", `una despublicada se vuelve a publicar (${rRepub.json?.datos?.estado})`);

  // --- No se publica lo que ya cerró (RN-03, RF-10) -------------------------------------
  const vencidaId = await crear(`Convocatoria vencida ${sufijo}`, enDias(30));
  await api(adm, "PATCH", `/api/admin/convocatorias/${vencidaId}`, ficha({ nombre: `Convocatoria vencida ${sufijo}`, urlPostulacion: "https://entidad.gov.co/y", requisitos: requisito }));
  await svc.from("convocatorias").update({ fecha_cierre: enDias(-1) }).eq("id", vencidaId);
  const rVencida = await api(adm, "POST", `/api/admin/convocatorias/${vencidaId}/publicar`, {});
  ok(rVencida.status === 400 && /cierre/i.test(rVencida.json.error), `publicar una ya vencida → 400 ("${rVencida.json?.error}")`);

  // Desde 'cerrada' se puede volver a publicar si se corrige la fecha (docs/05 §9.15).
  await svc.from("convocatorias").update({ estado: "cerrada" }).eq("id", vencidaId);
  ok((await api(adm, "POST", `/api/admin/convocatorias/${vencidaId}/publicar`, {})).status === 400, "una cerrada y vencida tampoco se publica");
  await svc.from("convocatorias").update({ fecha_cierre: enDias(20) }).eq("id", vencidaId);
  const rCerrada = await api(adm, "POST", `/api/admin/convocatorias/${vencidaId}/publicar`, {});
  ok(rCerrada.status === 200 && rCerrada.json.datos.estado === "publicada",
    `una cerrada con la fecha corregida se vuelve a publicar (${rCerrada.status}, ${rCerrada.json?.datos?.estado})`);

  // --- La función SQL es la barrera, no el endpoint (RNF-20) -----------------------------
  const otraId = await crear(`Convocatoria directa ${sufijo}`, enDias(30));
  const { error: eDirecto } = await adm.cliente.rpc("publicar_convocatoria", { p_id: otraId, p_publicar: true });
  ok(eDirecto?.hint === "publicada_incompleta",
    `llamar a la función saltándose el endpoint, sin enlace ni requisitos → rechazada (${eDirecto?.hint ?? "pasó"})`);
  const { error: eEmpresa } = await emp.cliente.rpc("publicar_convocatoria", { p_id: convId, p_publicar: false });
  ok(Boolean(eEmpresa), `una empresa llamando a la función → rechazada (${eEmpresa?.hint ?? eEmpresa?.message ?? "pasó"})`);
  const { data: sigue } = await svc.from("convocatorias").select("estado").eq("id", convId).single();
  ok(sigue.estado === "publicada", "la convocatoria sigue publicada tras el intento de la empresa");

  // --- El editor muestra el botón que toca ------------------------------------------------
  const pagina = await fetch(`${APP}/admin/convocatorias/${convId}`, { headers: { cookie: adm.cookie() }, redirect: "manual" });
  const html = await pagina.text();
  ok(pagina.status === 200 && html.includes("Despublicar"), `el editor de una publicada ofrece "Despublicar" (${pagina.status})`);
  const pagBorrador = await fetch(`${APP}/admin/convocatorias/${otraId}`, { headers: { cookie: adm.cookie() }, redirect: "manual" });
  const htmlBorrador = await pagBorrador.text();
  ok(pagBorrador.status === 200 && htmlBorrador.includes("Publicar") && !htmlBorrador.includes("próximamente"),
    `el editor de un borrador ofrece "Publicar" de verdad (${pagBorrador.status})`);
} finally {
  if (convocatorias.length) await svc.from("convocatorias").delete().in("id", convocatorias);
  if (fuentes.length) await svc.from("fuentes").delete().in("id", fuentes);
  for (const id of cuentas) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (invitaciones.length) await svc.from("invitaciones_admin").delete().in("id", invitaciones);
  console.log("datos y cuentas de prueba borrados");
}
console.log(fallas ? `${fallas} FALLAS` : "TODO PASÓ");
process.exitCode = fallas ? 1 : 0;
