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

// En el equipo de desarrollo, ciertas peticiones hacia Supabase se pierden segun
// su tamano exacto en bytes: la llamada muere con ECONNRESET tras ~19 s y el
// endpoint responde 500 (docs/incidentes/2026-09-22-cuelgue-al-guardar-convocatoria.md,
// diagnosticado en la sesion 016; se comprueba con scripts/diagnostico-red-supabase.mjs).
// Reintentar repite los mismos bytes y casi nunca cura, pero se deja para que el
// sintoma se vea en pantalla. Solo lo idempotente: repetir un POST podria duplicar
// lo que el primero si llego a hacer.
async function api(s, metodo, ruta, cuerpo, { origen = APP } = {}) {
  const headers = { "content-type": "application/json" };
  if (s) headers.cookie = s.cookie();
  if (origen) headers.origin = origen;
  const enviar = () => fetch(APP + ruta, { method: metodo, headers, redirect: "manual", body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  let r = await enviar();
  for (let intento = 1; intento <= 3 && r.status === 500 && (metodo === "GET" || metodo === "PATCH"); intento++) {
    console.log(`   (reintento ${intento} por fallo de red en ${metodo} ${ruta.slice(0, 48)})`);
    await new Promise((espera) => setTimeout(espera, 1500 * intento));
    r = await enviar();
  }
  return { status: r.status, json: await r.json().catch(() => null) };
}

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], invitaciones = [], fuentes = [], convocatorias = [], categorias = [];
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
  const requisito = [{ descripcion: "Camara de comercio", tipo: "documento", obligatorio: true }];
  const dosRequisitos = [...requisito, { descripcion: "Ser pyme", tipo: "condicion", obligatorio: false }];

  // Categoria y adjunto reales: RN-01 los exige desde la sesion 015.
  const rCat = await api(adm, "POST", "/api/admin/categorias", { tipo: "sector", nombre: `Sector publicar ${sufijo}` });
  categorias.push(rCat.json.datos.id);

  const convId = await crear(`Convocatoria publicar ${sufijo}`, enDias(30));
  const pub = `/api/admin/convocatorias/${convId}/publicar`, despub = `/api/admin/convocatorias/${convId}/despublicar`;

  // Sube un adjunto de verdad por los 3 pasos de docs/05 seccion 9.14.
  const adjuntar = async (id) => {
    const base = `/api/admin/convocatorias/${id}/documentos`;
    const firma = await api(adm, "POST", `${base}/subida`, { nombre: "TDR", tipo: "TDR", extension: "pdf", tamanoBytes: 80 });
    const cuerpo = new Blob([Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n")], { type: "application/pdf" });
    await adm.cliente.storage.from("documentos-convocatorias").uploadToSignedUrl(firma.json.datos.ruta, firma.json.datos.token, cuerpo, { contentType: "application/pdf" });
    const r = await api(adm, "POST", base, { documentoId: firma.json.datos.documentoId, nombre: "TDR", tipo: "TDR", extension: "pdf" });
    return r.status === 200;
  };

  // --- RF-85: publicar no existe para quien no es administrador --------------------
  ok((await api(null, "POST", pub, {})).status === 404, "anonimo - publicar -> 404");
  ok((await api(emp, "POST", pub, {})).status === 404, "empresa - publicar -> 404");
  ok((await api(emp, "POST", despub, {})).status === 404, "empresa - despublicar -> 404");
  ok((await api(adm, "POST", pub, {}, { origen: "https://otro.example" })).status === 403, "administrador desde otro origen - publicar -> 403");
  ok((await api(adm, "POST", `/api/admin/convocatorias/${crypto.randomUUID()}/publicar`, {})).status === 404, "publicar una convocatoria inexistente -> 404");
  ok((await api(adm, "POST", "/api/admin/convocatorias/no-es-uuid/publicar", {})).status === 404, "id que no es uuid -> 404");

  // --- RN-01: 400 enumerando de una vez todo lo que falta (lista de la sesion 015) ---
  const nombra = (t, ...partes) => partes.every((x) => new RegExp(x, "i").test(t ?? ""));
  const sinNada = await api(adm, "POST", pub, {});
  ok(sinNada.status === 400 && nombra(sinNada.json.error, "ubicaci", "descripci", "enlace oficial", "categor", "documento adjunto", "requisito"),
    `sin nada -> 400 nombrando las seis cosas que faltan ("${sinNada.json?.error}")`);

  // Todo menos el adjunto: debe nombrar solo el adjunto.
  await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, ficha({
    ubicacion: "Nacional", descripcion: "Objeto de la convocatoria", urlPostulacion: "https://entidad.gov.co/x",
    categorias: [rCat.json.datos.id], requisitos: dosRequisitos,
  }));
  const faltaAdjunto = await api(adm, "POST", pub, {});
  ok(faltaAdjunto.status === 400 && nombra(faltaAdjunto.json.error, "documento adjunto") && !/ubicaci/i.test(faltaAdjunto.json.error),
    `todo menos el adjunto -> 400 nombrando solo el adjunto ("${faltaAdjunto.json?.error}")`);

  ok(await adjuntar(convId), "adjunto subido para poder publicar");

  // Con un solo requisito: RN-01 pide dos.
  await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, ficha({
    ubicacion: "Nacional", descripcion: "Objeto de la convocatoria", urlPostulacion: "https://entidad.gov.co/x",
    categorias: [rCat.json.datos.id], requisitos: requisito,
  }));
  const faltaSegundo = await api(adm, "POST", pub, {});
  ok(faltaSegundo.status === 400 && /segundo requisito/i.test(faltaSegundo.json.error ?? ""),
    `con un solo requisito -> 400 pidiendo el segundo ("${faltaSegundo.json?.error}")`);

  // Sin categoria.
  await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, ficha({
    ubicacion: "Nacional", descripcion: "Objeto de la convocatoria", urlPostulacion: "https://entidad.gov.co/x",
    categorias: [], requisitos: dosRequisitos,
  }));
  const faltaCategoria = await api(adm, "POST", pub, {});
  ok(faltaCategoria.status === 400 && nombra(faltaCategoria.json.error, "categor") && !/documento/i.test(faltaCategoria.json.error),
    `sin categoria -> 400 nombrando solo la categoria ("${faltaCategoria.json?.error}")`);

  // Que siga en borrador despues de cada intento fallido.
  const tras = await api(adm, "GET", `/api/admin/convocatorias/${convId}`);
  ok(tras.json.datos.estado === "borrador", `tras los rechazos sigue en borrador (${tras.json.datos.estado})`);

  // --- Publicar (CU-05) ---------------------------------------------------------------
  const fichaCompleta = ficha({
    ubicacion: "Nacional", descripcion: "Objeto de la convocatoria", urlPostulacion: "https://entidad.gov.co/x",
    categorias: [rCat.json.datos.id], requisitos: dosRequisitos,
  });
  await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, fichaCompleta);
  const rPub = await api(adm, "POST", pub, {});
  ok(rPub.status === 200 && rPub.json.datos.estado === "publicada", `publicar con la ficha completa -> 200 (${rPub.status}, ${rPub.json?.datos?.estado})`);
  ok(Boolean(rPub.json.datos.publicadaAt), "queda registrado cuando se publico");
  ok(rPub.json.datos.documentos.length === 1, "la publicada lleva su documento adjunto (RN-01, sesion 015)");

  // RNF-11: queda registrado quien publico.
  const { data: fila } = await svc.from("convocatorias").select("publicado_por, publicada_at").eq("id", convId).single();
  ok(fila.publicado_por === uAdmin.user.id, "queda registrado quien publico (RNF-11)");
  ok((await api(adm, "POST", pub, {})).status === 409, "publicar dos veces -> 409");

  // --- La regla se mantiene al editar (RN-01) -------------------------------------------
  // 400, no 409: la restriccion convocatorias_publicada_con_enlace de la tabla
  // ataja antes que la comprobacion de la funcion. Impide la operacion igual.
  const quitarEnlace = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...fichaCompleta, urlPostulacion: "" });
  ok(quitarEnlace.status === 400 || quitarEnlace.status === 409, `quitarle el enlace a una publicada -> rechazado (${quitarEnlace.status})`);
  const quitarReq = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...fichaCompleta, requisitos: [] });
  ok(quitarReq.status === 409, `dejar sin requisitos a una publicada -> 409 (${quitarReq.status})`);
  // Sesion 016: guardar vuelve a exigir la ficha completa de RN-01 a una publicada.
  for (const [que, cambio] of [
    ["la ubicacion", { ubicacion: "" }],
    ["la descripcion", { descripcion: "" }],
    ["la categoria", { categorias: [] }],
    ["el segundo requisito", { requisitos: requisito }],
  ]) {
    const r = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...fichaCompleta, ...cambio });
    ok(r.status === 409, `quitarle ${que} a una publicada -> 409 (${r.status})`);
  }
  // CU-03 1b (sesion 016): el ultimo adjunto de una publicada no se quita.
  const docs = await api(adm, "GET", `/api/admin/convocatorias/${convId}/documentos`);
  const quitarUltimo = await api(adm, "DELETE", `/api/admin/convocatorias/${convId}/documentos/${docs.json?.datos?.[0]?.id}`);
  ok(docs.json?.datos?.length === 1 && quitarUltimo.status === 409, `quitarle el ultimo adjunto a una publicada -> 409 (${quitarUltimo.status})`);
  // Se deja como estaba para el resto de la prueba.
  await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, fichaCompleta);
  const intacta = await api(adm, "GET", `/api/admin/convocatorias/${convId}`);
  ok(intacta.json.datos.ubicacion === "Nacional" && intacta.json.datos.requisitos.length === 2 && intacta.json.datos.estado === "publicada",
    "la publicada sigue completa tras los intentos");

  // CU-05 3e (sesion 017): una publicada con fecha ya pasada se permite, con aviso.
  const fechaPasada = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...fichaCompleta, fechaCierre: enDias(-2) });
  ok(fechaPasada.status === 200 && /medianoche/.test(fechaPasada.json?.aviso ?? "") && fechaPasada.json?.datos?.estado === "publicada",
    `publicada con fecha pasada -> 200 con aviso y sigue publicada (${fechaPasada.status}: ${fechaPasada.json?.aviso})`);
  const sinAviso = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, fichaCompleta);
  ok(sinAviso.status === 200 && sinAviso.json?.aviso === null, "con la fecha vigente otra vez -> sin aviso");

  // --- Despublicar (CU-05 3b) -----------------------------------------------------------
  const rDespub = await api(adm, "POST", despub, {});
  ok(rDespub.status === 200 && rDespub.json.datos.estado === "despublicada", `despublicar → 200 (${rDespub.json?.datos?.estado})`);
  ok(Boolean(rDespub.json.datos.publicadaAt), "despublicar conserva el rastro de que estuvo publicada (RN-07)");
  ok((await api(adm, "POST", despub, {})).status === 409, "despublicar dos veces → 409");
  const rRepub = await api(adm, "POST", pub, {});
  ok(rRepub.status === 200 && rRepub.json.datos.estado === "publicada", `una despublicada se vuelve a publicar (${rRepub.json?.datos?.estado})`);

  // --- No se publica lo que ya cerró (RN-03, RF-10) -------------------------------------
  const vencidaId = await crear(`Convocatoria vencida ${sufijo}`, enDias(30));
  // Ficha completa: si no, fallaria por incompleta antes de llegar a la fecha.
  await api(adm, "PATCH", `/api/admin/convocatorias/${vencidaId}`, {
    ...fichaCompleta, nombre: `Convocatoria vencida ${sufijo}`, urlPostulacion: "https://entidad.gov.co/y",
  });
  ok(await adjuntar(vencidaId), "adjunto de la convocatoria vencida");
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
  for (const id of convocatorias) {
    const { data: objetos } = await svc.storage.from("documentos-convocatorias").list(id);
    if (objetos?.length) await svc.storage.from("documentos-convocatorias").remove(objetos.map((o) => `${id}/${o.name}`));
  }
  if (convocatorias.length) await svc.from("convocatorias").delete().in("id", convocatorias);
  if (categorias.length) await svc.from("categorias").delete().in("id", categorias);
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
