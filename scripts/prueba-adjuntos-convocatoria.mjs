// Prueba de los adjuntos de convocatoria y de Storage (RF-07, CU-03, RNF-16, RNF-18, RNF-25, RN-33).
//
//   npm run dev                                   (en otra terminal; o PRUEBA_URL=http://localhost:3100 con next start)
//   node --env-file=.env.local scripts/prueba-adjuntos-convocatoria.mjs
//
// Igual que prueba-catalogo-admin.mjs: crea sus propias cuentas temporales —un
// administrador por la vía real de invitación, con MFA verificado, y una
// empresa—, sube archivos de verdad al bucket y borra todo al terminar.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import crypto from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.PRUEBA_URL ?? "http://localhost:3000";
const BUCKET = "documentos-convocatorias";
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

// Un PDF mínimo pero válido, para que el tipo que Storage detecte sea el real.
const pdf = (relleno = 0) => new Blob([Buffer.concat([Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"), Buffer.alloc(relleno, 0x20)])], { type: "application/pdf" });

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], invitaciones = [], fuentes = [], convocatorias = [];

try {
  // --- Cuentas temporales ---------------------------------------------------------
  const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
  const correoAdmin = `admin.adjuntos.${sufijo}@example.com`, correoEmpresa = `empresa.adjuntos.${sufijo}@example.com`;
  const clave = crypto.randomBytes(18).toString("base64url");

  const { data: invId } = await svc.rpc("crear_invitacion_admin", { p_propietario: propietario.id, p_correo: correoAdmin, p_nombre: "Admin adjuntos" });
  if (invId) invitaciones.push(invId);
  const { data: uAdmin } = await svc.auth.admin.createUser({ email: correoAdmin, password: clave, email_confirm: true });
  cuentas.push(uAdmin.user.id);
  await svc.rpc("aceptar_invitacion_admin", { p_invitacion: invId, p_usuario: uAdmin.user.id });
  const { data: uEmp } = await svc.auth.admin.createUser({ email: correoEmpresa, password: clave, email_confirm: true, user_metadata: { rol: "empresa", nombre: "Empresa adjuntos" } });
  cuentas.push(uEmp.user.id);

  const adm = sesion(), emp = sesion();
  await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: clave });
  await emp.cliente.auth.signInWithPassword({ email: correoEmpresa, password: clave });

  // --- Los buckets existen y son privados, con sus límites (RNF-16, RNF-18) --------
  const { data: buckets } = await svc.storage.listBuckets();
  const porId = Object.fromEntries(buckets.map((b) => [b.id, b]));
  ok(["documentos-convocatorias", "fotos-consultores", "hojas-de-vida"].every((b) => porId[b]), "existen los 3 buckets");
  ok(["documentos-convocatorias", "fotos-consultores", "hojas-de-vida"].every((b) => porId[b] && porId[b].public === false), "los 3 buckets son privados (RNF-16)");
  ok(porId[BUCKET]?.file_size_limit === 20971520, `documentos-convocatorias limita a 20 MB (${porId[BUCKET]?.file_size_limit})`);
  ok(porId["hojas-de-vida"]?.file_size_limit === 10485760 && porId["fotos-consultores"]?.file_size_limit === 5242880, "hoja de vida 10 MB y foto 5 MB (RNF-18)");
  ok((porId[BUCKET]?.allowed_mime_types ?? []).includes("application/pdf") && !(porId[BUCKET]?.allowed_mime_types ?? []).includes("image/png"),
    "documentos-convocatorias admite PDF y no imágenes (RNF-18)");

  // --- Una convocatoria en borrador -----------------------------------------------
  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  await svc.from("invitaciones_admin").update({ estado: "aceptada", resuelta_at: new Date().toISOString() }).eq("id", invId);
  ok(!eMfa, `administrador verifica su TOTP (aal2) ${eMfa?.message ?? ""}`);

  const rFuente = await api(adm, "POST", "/api/admin/fuentes", { nombre: `Fuente adjuntos ${sufijo}` });
  fuentes.push(rFuente.json.datos.id);
  const rConv = await api(adm, "POST", "/api/admin/convocatorias", {
    fuenteId: rFuente.json.datos.id, nombre: `Convocatoria adjuntos ${sufijo}`, entidadConvocante: "Entidad", fechaCierre: "2026-12-31",
  });
  const convId = rConv.json.datos.id;
  convocatorias.push(convId);
  ok(rConv.status === 200, `convocatoria de prueba creada (${rConv.status})`);

  const base = `/api/admin/convocatorias/${convId}/documentos`;

  // --- RF-85: los adjuntos no existen para quien no es administrador ---------------
  ok((await api(null, "GET", base)).status === 404, "anónimo · GET documentos → 404");
  ok((await api(emp, "GET", base)).status === 404, "empresa · GET documentos → 404");
  ok((await api(emp, "POST", `${base}/subida`, { nombre: "x", tipo: "TDR", extension: "pdf", tamanoBytes: 10 })).status === 404, "empresa · POST subida → 404");
  ok((await api(adm, "POST", `${base}/subida`, { nombre: "x", tipo: "TDR", extension: "pdf", tamanoBytes: 10 }, { origen: "https://otro.example" })).status === 403,
    "administrador desde otro origen · POST subida → 403");

  // --- RNF-18: validación en el servidor ------------------------------------------
  ok((await api(adm, "POST", `${base}/subida`, { nombre: "", tipo: "TDR", extension: "pdf", tamanoBytes: 10 })).status === 400, "sin nombre descriptivo → 400");
  ok((await api(adm, "POST", `${base}/subida`, { nombre: "x", tipo: "otro", extension: "pdf", tamanoBytes: 10 })).status === 400, "tipo de documento inválido → 400");
  ok((await api(adm, "POST", `${base}/subida`, { nombre: "x", tipo: "TDR", extension: "exe", tamanoBytes: 10 })).status === 400, "extensión .exe → 400");
  ok((await api(adm, "POST", `${base}/subida`, { nombre: "x", tipo: "TDR", extension: "pdf", tamanoBytes: 21 * 1024 * 1024 })).status === 400, "21 MB declarados → 400 (RNF-18)");
  ok((await api(adm, "POST", `/api/admin/convocatorias/${crypto.randomUUID()}/documentos/subida`, { nombre: "x", tipo: "TDR", extension: "pdf", tamanoBytes: 10 })).status === 404,
    "subida a una convocatoria inexistente → 404");

  // --- Subida completa (CU-03) ------------------------------------------------------
  const firma = await api(adm, "POST", `${base}/subida`, { nombre: "Términos de referencia", tipo: "TDR", extension: "pdf", tamanoBytes: 200 });
  ok(firma.status === 200 && firma.json.datos.ruta.startsWith(`${convId}/`) && firma.json.datos.token,
    `URL firmada de subida, con la ruta que decide el servidor (${firma.status})`);
  ok(!firma.json.datos.ruta.includes("Términos"), "el nombre del archivo no llega a la ruta del objeto");

  const { error: eSubida } = await adm.cliente.storage.from(BUCKET).uploadToSignedUrl(firma.json.datos.ruta, firma.json.datos.token, pdf(120), { contentType: "application/pdf" });
  ok(!eSubida, `el archivo sube al bucket con la sesión del administrador ${eSubida?.message ?? ""}`);

  const registro = await api(adm, "POST", base, { documentoId: firma.json.datos.documentoId, nombre: "Términos de referencia", tipo: "TDR", extension: "pdf" });
  ok(registro.status === 200 && registro.json.datos.tamanoBytes > 0 && registro.json.datos.tipoMime === "application/pdf",
    `registro con el tamaño y el tipo reales leídos de Storage (${registro.status}, ${registro.json?.datos?.tamanoBytes} B)`);
  const docId = registro.json.datos.id;

  const listado = await api(adm, "GET", base);
  ok(listado.status === 200 && listado.json.datos.length === 1, `GET documentos → 1 adjunto (${listado.json?.datos?.length})`);

  // Registrar sin haber subido nada: no deja fila.
  const huerfano = await api(adm, "POST", base, { documentoId: crypto.randomUUID(), nombre: "Fantasma", tipo: "anexo", extension: "pdf" });
  ok(huerfano.status === 400, `registrar un archivo que nunca se subió → 400 (${huerfano.status})`);

  // El tipo real tiene que casar con la extensión de la ruta.
  const firma2 = await api(adm, "POST", `${base}/subida`, { nombre: "Anexo falso", tipo: "anexo", extension: "zip", tamanoBytes: 200 });
  await adm.cliente.storage.from(BUCKET).uploadToSignedUrl(firma2.json.datos.ruta, firma2.json.datos.token, pdf(), { contentType: "application/pdf" });
  const rFalso = await api(adm, "POST", base, { documentoId: firma2.json.datos.documentoId, nombre: "Anexo falso", tipo: "anexo", extension: "zip" });
  ok(rFalso.status === 400, `un PDF subido como .zip → 400 y se borra el objeto (${rFalso.status})`);
  const { data: restos } = await svc.storage.from(BUCKET).list(convId, { search: firma2.json.datos.documentoId });
  ok((restos ?? []).length === 0, "el objeto rechazado no queda en el bucket");

  // --- Renombrar y cambiar el tipo (CU-03 1a) ---------------------------------------
  const rNombre = await api(adm, "PATCH", `${base}/${docId}`, { nombre: "TDR definitivo" });
  ok(rNombre.status === 200 && rNombre.json.datos.nombre === "TDR definitivo", `renombrar → 200 (${rNombre.status})`);
  const rTipo = await api(adm, "PATCH", `${base}/${docId}`, { tipo: "terminos" });
  ok(rTipo.status === 200 && rTipo.json.datos.tipo === "terminos", `cambiar el tipo → 200 (${rTipo.status})`);
  ok((await api(adm, "PATCH", `${base}/${docId}`, { nombre: "" })).status === 400, "renombrar a vacío → 400");
  ok((await api(emp, "PATCH", `${base}/${docId}`, { nombre: "mío" })).status === 404, "empresa · renombrar → 404");
  ok((await api(adm, "PATCH", `${base}/${crypto.randomUUID()}`, { nombre: "x" })).status === 404, "renombrar un documento inexistente → 404");
  ok((await api(adm, "PATCH", `${base}/no-es-uuid`, { nombre: "x" })).status === 404, "docId que no es uuid → 404");

  // El trigger de la base impide cambiar el archivo por la vía del update (docs/05 §9.14).
  const { error: eInmutable } = await adm.cliente.from("documentos_convocatoria").update({ storage_path: `${convId}/otro.pdf` }).eq("id", docId);
  ok(eInmutable?.hint === "adjunto_inmutable", `cambiar storage_path con la sesión del administrador → rechazado (${eInmutable?.hint ?? "sin error"})`);

  // --- Descarga por URL firmada (RNF-16) --------------------------------------------
  const enlace = await api(adm, "GET", `${base}/${docId}/enlace`);
  ok(enlace.status === 200 && enlace.json.datos.url.includes("token="), `enlace de descarga firmado (${enlace.status})`);
  // Se mide sobre el propio token (exp - iat): el reloj de esta máquina va
  // atrasado frente a Supabase (hallazgo de la sesión 009) y restarle Date.now()
  // daría de más.
  const firmado = JSON.parse(Buffer.from(new URL(enlace.json.datos.url).searchParams.get("token").split(".")[1], "base64url").toString());
  const vida = firmado.exp - firmado.iat;
  ok(vida > 0 && vida <= 15 * 60, `la URL firmada vive 15 minutos o menos (${vida} s)`);
  const descarga = await fetch(enlace.json.datos.url);
  ok(descarga.ok && (await descarga.text()).startsWith("%PDF"), `la URL firmada entrega el archivo (${descarga.status})`);
  // El nombre viaja percent-encoded en la cabecera (RFC 5987).
  const disposicion = decodeURIComponent(descarga.headers.get("content-disposition") ?? "");
  ok(disposicion.includes("TDR definitivo"), `la descarga conserva el nombre descriptivo (${disposicion})`);
  ok((await api(emp, "GET", `${base}/${docId}/enlace`)).status === 404, "empresa · pedir el enlace → 404");

  // RN-33 · la ruta sin firmar no entrega nada, ni siquiera con la sesión de la empresa.
  const directo = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${convId}/${docId}.pdf`, { headers: { apikey: ANON } });
  ok(directo.status === 400 || directo.status === 401 || directo.status === 403 || directo.status === 404,
    `la ruta pedida sin firmar → denegada (${directo.status})`);
  const { data: leeEmpresa } = await emp.cliente.storage.from(BUCKET).list(convId);
  ok((leeEmpresa ?? []).length === 0, "una cuenta de empresa no lista el bucket de adjuntos (RN-33)");
  const { error: eSubeEmpresa } = await emp.cliente.storage.from(BUCKET).upload(`${convId}/intruso.pdf`, pdf());
  ok(Boolean(eSubeEmpresa), `una cuenta de empresa no puede subir al bucket (${eSubeEmpresa?.message ?? "pudo subir"})`);

  // --- La ficha del editor trae los adjuntos ----------------------------------------
  const ficha = await api(adm, "GET", `/api/admin/convocatorias/${convId}`);
  ok(ficha.status === 200 && ficha.json.datos.documentos.length === 1 && ficha.json.datos.documentos[0].nombre === "TDR definitivo",
    `la ficha de la convocatoria trae sus adjuntos (${ficha.json?.datos?.documentos?.length})`);
  const pagina = await fetch(`${APP}/admin/convocatorias/${convId}`, { headers: { cookie: adm.cookie() }, redirect: "manual" });
  const html = await pagina.text();
  ok(pagina.status === 200 && html.includes("TDR definitivo"), `el editor muestra el adjunto real (${pagina.status})`);

  // --- Quitar (CU-03 1a) --------------------------------------------------------------
  ok((await api(emp, "DELETE", `${base}/${docId}`)).status === 404, "empresa · quitar → 404");
  const rQuitar = await api(adm, "DELETE", `${base}/${docId}`);
  ok(rQuitar.status === 200, `quitar el adjunto → 200 (${rQuitar.status})`);
  const { data: tras } = await svc.storage.from(BUCKET).list(convId);
  ok((tras ?? []).length === 0, "al quitar el adjunto también desaparece el objeto del bucket");
  ok((await api(adm, "GET", base)).json.datos.length === 0, "el listado queda vacío");
  ok((await api(adm, "DELETE", `${base}/${docId}`)).status === 404, "quitar dos veces → 404");
} finally {
  for (const id of convocatorias) {
    const { data: objetos } = await svc.storage.from(BUCKET).list(id);
    if (objetos?.length) await svc.storage.from(BUCKET).remove(objetos.map((o) => `${id}/${o.name}`));
  }
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
