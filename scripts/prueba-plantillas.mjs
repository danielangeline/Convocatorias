// Prueba del panel de plantillas de generación contra Supabase real
// (CU-37 · RF-63, RF-99, RF-85, RNF-20, RNF-28, RNF-30 · docs/05 §9.27 y §9.30 · Sprint 5).
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-plantillas.mjs
//
// No llama a la IA. Crea un administrador por invitación con TOTP, una empresa
// y un consultor temporales. La base es la de producción: la versión que crea
// la prueba repite el texto, el modelo y los precios de la activa, y solo queda
// activa unos segundos; al terminar se reactiva la que estaba y se borra todo.
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
  const headers = { "content-type": "application/json" };
  if (s) headers.cookie = s.cookie();
  if (origen) headers.origin = origen;
  const r = await fetch(APP + ruta, { method: metodo, headers, redirect: "manual", body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* HTML */ }
  return { status: r.status, json, texto, destino: r.headers.get("location") };
}
const b32 = (s) => { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const ch of s) bits += a.indexOf(ch).toString(2).padStart(5, "0"); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); };
const desfase = new Date((await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })).headers.get("date")).getTime() - Date.now();
const totp = (sec) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor((Date.now() + desfase) / 30000))); const h = crypto.createHmac("sha1", b32(sec)).update(c).digest(); const k = h[h.length - 1] & 15; return String((h.readUInt32BE(k) & 0x7fffffff) % 1e6).padStart(6, "0"); };

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], invitaciones = [], creadas = [], creadasProyecto = [];
const { data: activaInicial } = await svc.from("plantillas_generacion").select("*").eq("activa", true).single();
const { data: activaProyectoInicial } = await svc.from("plantillas_proyecto").select("*").eq("activa", true).single();

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre, extra = {}) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.plantillas.${sufijo}@example.com`, password: clave, email_confirm: true,
      user_metadata: { rol, nombre, consentimiento_datos: true, ...extra },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    const s = sesion();
    const { error: e } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (e) throw e;
    return s;
  };
  const empresa = await crearCuenta("empresa", "empresa", { nombre_empresa: `Empresa ${sufijo}` });
  const consultor = await crearCuenta("consultor", "consultor");

  // Administrador por invitación (CU-41, CU-42); primero sin MFA.
  const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
  const correoAdmin = `admin.plantillas.${sufijo}@example.com`;
  const { data: invId } = await svc.rpc("crear_invitacion_admin", { p_propietario: propietario.id, p_correo: correoAdmin, p_nombre: "Admin plantillas" });
  invitaciones.push(invId);
  const { data: uAdmin } = await svc.auth.admin.createUser({ email: correoAdmin, password: clave, email_confirm: true });
  cuentas.push(uAdmin.user.id);
  await svc.rpc("aceptar_invitacion_admin", { p_invitacion: invId, p_usuario: uAdmin.user.id });
  const adm = sesion();
  await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: clave });

  // --- Quien no es administrador con MFA: 404, como una ruta inexistente (RF-85, RNF-28) ---
  const cuerpoValido = {
    contenido: activaInicial.contenido, modelo: activaInicial.modelo,
    precioEntradaUsdMtok: Number(activaInicial.precio_entrada_usd_mtok), precioSalidaUsdMtok: Number(activaInicial.precio_salida_usd_mtok),
    topeCaracteresTdr: activaInicial.tope_caracteres_tdr,
  };
  const anon = await api(null, "GET", "/api/admin/plantillas");
  ok(anon.status === 404, `RF-85: anónimo -> 404 (${anon.status})`);
  for (const [nombre, s] of [["empresa", empresa], ["consultor", consultor]]) {
    const g = await api(s, "GET", "/api/admin/plantillas");
    const p = await api(s, "POST", "/api/admin/plantillas", cuerpoValido);
    const a = await api(s, "POST", `/api/admin/plantillas/${activaInicial.id}/activar`, {});
    ok(g.status === 404 && p.status === 404 && a.status === 404, `RF-85/RNF-28: ${nombre} -> 404 en listar, crear y activar (${g.status}/${p.status}/${a.status})`);
  }
  // El administrador sin MFA va a /mfa (RNF-28), en la API y en la pantalla.
  const sinMfa = await Promise.all([api(adm, "GET", "/api/admin/plantillas"), api(adm, "POST", "/api/admin/plantillas", cuerpoValido), api(adm, "GET", "/admin/plantillas")]);
  ok(sinMfa.every((r) => r.status === 307 && /\/mfa/.test(r.destino ?? "")), `RNF-28: administrador sin MFA -> /mfa (${sinMfa.map((r) => r.status).join("/")})`);
  const { count: sinCrear } = await svc.from("plantillas_generacion").select("id", { count: "exact", head: true }).eq("creada_por", uAdmin.user.id);
  ok(sinCrear === 0, "RNF-28: y no creó ninguna versión");
  const pantallaEmpresa = await api(empresa, "GET", "/admin/plantillas");
  ok(pantallaEmpresa.status === 404, `RF-85: la pantalla responde 404 a la empresa (${pantallaEmpresa.status})`);

  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  ok(!eMfa, `administrador verifica su TOTP (aal2) ${eMfa?.message ?? ""}`);

  // --- Listar (CU-37 paso 1) -----------------------------------------------------------------
  const lista = await api(adm, "GET", "/api/admin/plantillas");
  const activa = lista.json?.datos?.find((p) => p.activa);
  ok(lista.status === 200 && activa?.id === activaInicial.id && typeof activa.documentos === "number",
    `CU-37: lista las versiones con la activa y sus cifras (${lista.status}, ${lista.json?.datos?.length} versiones)`);
  const pantalla = await api(adm, "GET", "/admin/plantillas");
  ok(pantalla.status === 200 && pantalla.texto.includes("Plantillas de la IA") && new RegExp(`Versión (<!-- -->)?${activaInicial.version}`).test(pantalla.texto),
    "CU-37: la pantalla del panel muestra las versiones");

  // --- Validación del servidor (RNF-20) ----------------------------------------------------
  const invalidos = [
    [{ ...cuerpoValido, contenido: "corta" }, "instrucción corta"],
    [{ ...cuerpoValido, modelo: "GPT 5; drop" }, "modelo con caracteres no válidos"],
    [{ ...cuerpoValido, precioEntradaUsdMtok: -1 }, "precio negativo"],
    [{ ...cuerpoValido, precioSalidaUsdMtok: "mucho" }, "precio que no es número"],
    [{ ...cuerpoValido, topeCaracteresTdr: 500 }, "tope del TDR bajo el mínimo"],
    [{ ...cuerpoValido, contenido: "x".repeat(50_001) }, "instrucción demasiado larga"],
  ];
  for (const [cuerpo, caso] of invalidos) {
    const r = await api(adm, "POST", "/api/admin/plantillas", cuerpo);
    ok(r.status === 400 && r.json?.error, `RNF-20: ${caso} -> 400 (${r.status})`);
  }
  ok((await api(adm, "POST", "/api/admin/plantillas", cuerpoValido, { origen: "https://otro.example" })).status === 403, "RNF-30: crear desde otro origen -> 403");

  // --- Crear y activar (CU-37 pasos 2 y 3) --------------------------------------------------
  const nueva = await api(adm, "POST", "/api/admin/plantillas", cuerpoValido);
  const idNueva = nueva.json?.datos?.id;
  if (idNueva) creadas.push(idNueva);
  const { data: filaNueva } = await svc.from("plantillas_generacion").select("version, activa, creada_por").eq("id", idNueva).maybeSingle();
  ok(nueva.status === 200 && filaNueva && !filaNueva.activa && filaNueva.version === activaInicial.version + 1 && filaNueva.creada_por === uAdmin.user.id,
    `CU-37 paso 2: crea la versión ${filaNueva?.version}, inactiva y con su autor (${nueva.status})`);
  ok((await api(adm, "POST", "/api/admin/plantillas/00000000-0000-0000-0000-000000000000/activar", {})).status === 404, "CU-37: activar una versión que no existe -> 404");
  ok((await api(adm, "POST", "/api/admin/plantillas/no-es-uuid/activar", {})).status === 404, "RNF-30: id que no es uuid -> 404");

  const activar = await api(adm, "POST", `/api/admin/plantillas/${idNueva}/activar`, {});
  const { data: activas } = await svc.from("plantillas_generacion").select("id, activada_por").eq("activa", true);
  ok(activar.status === 200 && activas?.length === 1 && activas[0].id === idNueva && activas[0].activada_por === uAdmin.user.id,
    `CU-37 paso 3: queda una sola activa, la nueva, con quién la activó (${activar.status})`);
  const volver = await api(adm, "POST", `/api/admin/plantillas/${activaInicial.id}/activar`, {});
  const { data: activas2 } = await svc.from("plantillas_generacion").select("id").eq("activa", true);
  ok(volver.status === 200 && activas2?.length === 1 && activas2[0].id === activaInicial.id, "CU-37: vuelve a la versión anterior");

  // Una versión no se edita, ni siquiera con service_role (RF-63).
  const { error: eEdit } = await svc.from("plantillas_generacion").update({ contenido: `${activaInicial.contenido} ` }).eq("id", activaInicial.id);
  ok(eEdit?.hint === "plantilla_inmutable", `RF-63: el contenido de una versión no cambia (${eEdit?.hint})`);

  // --- Plantilla de creación de proyectos (RF-99, sesión 030) ---------------------------------
  const cuerpoProyecto = {
    contenido: activaProyectoInicial.contenido, modelo: activaProyectoInicial.modelo,
    precioEntradaUsdMtok: Number(activaProyectoInicial.precio_entrada_usd_mtok), precioSalidaUsdMtok: Number(activaProyectoInicial.precio_salida_usd_mtok),
  };
  for (const [nombre, s] of [["anónimo", null], ["empresa", empresa], ["consultor", consultor]]) {
    const g = await api(s, "GET", "/api/admin/plantillas/proyecto");
    const p = await api(s, "POST", "/api/admin/plantillas/proyecto", cuerpoProyecto);
    const a = await api(s, "POST", `/api/admin/plantillas/proyecto/${activaProyectoInicial.id}/activar`, {});
    ok(g.status === 404 && p.status === 404 && a.status === 404, `RF-99/RF-85: ${nombre} -> 404 en listar, crear y activar (${g.status}/${p.status}/${a.status})`);
  }
  const listaP = await api(adm, "GET", "/api/admin/plantillas/proyecto");
  const activaP = listaP.json?.datos?.find((p) => p.activa);
  ok(listaP.status === 200 && activaP?.id === activaProyectoInicial.id && typeof activaP.generacionesExitosas === "number",
    `RF-99: lista las versiones de la plantilla de proyectos con sus cifras (${listaP.status})`);
  const pantallaP = await api(adm, "GET", "/admin/plantillas?tipo=proyecto");
  ok(pantallaP.status === 200 && pantallaP.texto.includes("Creación de proyectos") && pantallaP.texto.includes("Propuestas") && !pantallaP.texto.includes("Tope del TDR"),
    "RF-99: la pestaña de creación de proyectos se ve, con sus cifras y sin tope de TDR");
  for (const [cuerpo, caso] of [
    [{ ...cuerpoProyecto, contenido: "corta" }, "instrucción corta"],
    [{ ...cuerpoProyecto, modelo: "GPT 5; drop" }, "modelo no válido"],
    [{ ...cuerpoProyecto, precioEntradaUsdMtok: -1 }, "precio negativo"],
  ]) {
    const r = await api(adm, "POST", "/api/admin/plantillas/proyecto", cuerpo);
    ok(r.status === 400 && r.json?.error, `RNF-20: proyecto, ${caso} -> 400 (${r.status})`);
  }
  ok((await api(adm, "POST", "/api/admin/plantillas/proyecto", cuerpoProyecto, { origen: "https://otro.example" })).status === 403, "RNF-30: crear versión de proyecto desde otro origen -> 403");
  const nuevaP = await api(adm, "POST", "/api/admin/plantillas/proyecto", cuerpoProyecto);
  const idNuevaP = nuevaP.json?.datos?.id;
  if (idNuevaP) creadasProyecto.push(idNuevaP);
  const { data: filaP } = await svc.from("plantillas_proyecto").select("version, activa, creada_por").eq("id", idNuevaP).maybeSingle();
  ok(nuevaP.status === 200 && filaP && !filaP.activa && filaP.version === activaProyectoInicial.version + 1 && filaP.creada_por === uAdmin.user.id,
    `RF-99: crea la versión ${filaP?.version} de proyectos, inactiva y con su autor (${nuevaP.status})`);
  const actP = await api(adm, "POST", `/api/admin/plantillas/proyecto/${idNuevaP}/activar`, {});
  const { data: activasP } = await svc.from("plantillas_proyecto").select("id").eq("activa", true);
  ok(actP.status === 200 && activasP?.length === 1 && activasP[0].id === idNuevaP, `RF-99: activar deja una sola activa, la nueva (${actP.status})`);
  const volverP = await api(adm, "POST", `/api/admin/plantillas/proyecto/${activaProyectoInicial.id}/activar`, {});
  const { data: activasP2 } = await svc.from("plantillas_proyecto").select("id").eq("activa", true);
  ok(volverP.status === 200 && activasP2?.length === 1 && activasP2[0].id === activaProyectoInicial.id, "RF-99: vuelve a la versión anterior");
  const { data: plantillaDoc } = await svc.from("plantillas_generacion").select("id").eq("activa", true).single();
  ok(plantillaDoc?.id === activaInicial.id, "RF-99: activar en proyectos no toca la plantilla del documento");
} catch (e) {
  console.error("ERROR", e);
  fallas++;
} finally {
  // Deja activa la que estaba y borra lo creado (las FK de creada_por y activada_por lo exigen antes de las cuentas).
  const { data: ahora } = await svc.from("plantillas_generacion").select("id").eq("activa", true).maybeSingle();
  if (ahora?.id !== activaInicial.id) {
    await svc.from("plantillas_generacion").update({ activa: false }).eq("activa", true);
    await svc.from("plantillas_generacion").update({ activa: true }).eq("id", activaInicial.id);
  }
  await svc.from("plantillas_generacion").update({ activada_por: activaInicial.activada_por, activada_at: activaInicial.activada_at }).eq("id", activaInicial.id);
  if (creadas.length) {
    const { error } = await svc.from("plantillas_generacion").delete().in("id", creadas);
    if (error) console.log("No se pudo borrar la versión de prueba:", error.message);
  }
  const { data: ahoraP } = await svc.from("plantillas_proyecto").select("id").eq("activa", true).maybeSingle();
  if (ahoraP?.id !== activaProyectoInicial.id) {
    await svc.from("plantillas_proyecto").update({ activa: false }).eq("activa", true);
    await svc.from("plantillas_proyecto").update({ activa: true }).eq("id", activaProyectoInicial.id);
  }
  await svc.from("plantillas_proyecto").update({ activada_por: activaProyectoInicial.activada_por, activada_at: activaProyectoInicial.activada_at }).eq("id", activaProyectoInicial.id);
  if (creadasProyecto.length) {
    const { error } = await svc.from("plantillas_proyecto").delete().in("id", creadasProyecto);
    if (error) console.log("No se pudo borrar la versión de proyectos de prueba:", error.message);
  }
  for (const id of [...cuentas].reverse()) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (invitaciones.length) await svc.from("invitaciones_admin").delete().in("id", invitaciones);
  const { data: final } = await svc.from("plantillas_generacion").select("id").eq("activa", true).single();
  ok(final?.id === activaInicial.id, "limpieza: la plantilla activa es la del principio");
  const { data: finalP } = await svc.from("plantillas_proyecto").select("id").eq("activa", true).single();
  ok(finalP?.id === activaProyectoInicial.id, "limpieza: la plantilla de proyectos activa es la del principio");
  console.log(fallas === 0 ? "\nTODO PASA" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
