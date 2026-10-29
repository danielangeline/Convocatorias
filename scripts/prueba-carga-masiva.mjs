// Prueba de la carga masiva de convocatorias por CSV, con sus documentos, contra Supabase real (CU-50, RF-118, RF-07, RF-85, RN-07, RN-39, RN-40, RNF-18).
//
//   npm run dev                                   (en otra terminal; o PRUEBA_URL=http://localhost:3100 con next start)
//   node --env-file=.env.local scripts/prueba-carga-masiva.mjs
//
// Crea sus propias cuentas temporales —un administrador por la vía real de
// invitación, con MFA verificado, y una empresa—, una fuente y una categoría de
// prueba, y sube CSV como lo haría el navegador. Borra al terminar todo lo que crea.
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
// El reloj de la máquina puede ir atrasado frente a Supabase (hallazgo de la sesión 009).
const desfase = new Date((await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })).headers.get("date")).getTime() - Date.now();
const totp = (sec) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor((Date.now() + desfase) / 30000))); const h = crypto.createHmac("sha1", b32(sec)).update(c).digest(); const k = h[h.length - 1] & 15; return String((h.readUInt32BE(k) & 0x7fffffff) % 1e6).padStart(6, "0"); };

async function api(s, cuerpo) {
  const headers = { "content-type": "application/json", origin: APP };
  if (s) headers.cookie = s.cookie();
  const r = await fetch(APP + "/api/admin/convocatorias/carga-masiva", { method: "POST", headers, redirect: "manual", body: JSON.stringify(cuerpo) });
  return { status: r.status, json: await r.json().catch(() => null) };
}

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], invitaciones = [];
let fuenteId = null, categoriaId = null;
const fuentesExtra = [];

try {
  // --- Cuentas temporales ------------------------------------------------------
  const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
  const correoAdmin = `admin.carga.${sufijo}@example.com`, correoEmpresa = `empresa.carga.${sufijo}@example.com`;
  const clave = crypto.randomBytes(18).toString("base64url");
  const { data: invId } = await svc.rpc("crear_invitacion_admin", { p_propietario: propietario.id, p_correo: correoAdmin, p_nombre: "Admin carga" });
  invitaciones.push(invId);
  const { data: uAdmin } = await svc.auth.admin.createUser({ email: correoAdmin, password: clave, email_confirm: true });
  cuentas.push(uAdmin.user.id);
  await svc.rpc("aceptar_invitacion_admin", { p_invitacion: invId, p_usuario: uAdmin.user.id });
  const { data: uEmp } = await svc.auth.admin.createUser({ email: correoEmpresa, password: clave, email_confirm: true, user_metadata: { rol: "empresa", nombre: "Empresa carga" } });
  cuentas.push(uEmp.user.id);

  const adm = sesion(), emp = sesion();
  await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: clave });
  await emp.cliente.auth.signInWithPassword({ email: correoEmpresa, password: clave });

  // --- RF-85: el endpoint no existe para los demás ----------------------------
  ok((await api(null, { csv: "x" })).status === 404, "anónimo → 404");
  ok((await api(emp, { csv: "x" })).status === 404, "empresa → 404");
  const sinMfa = await fetch(APP + "/api/admin/convocatorias/carga-masiva", { method: "POST", headers: { cookie: adm.cookie(), origin: APP }, redirect: "manual" });
  ok(sinMfa.status === 307, `administrador sin MFA → 307 a /mfa (${sinMfa.status})`);

  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  await svc.from("invitaciones_admin").update({ estado: "aceptada", resuelta_at: new Date().toISOString() }).eq("id", invId);
  ok(!eMfa, "administrador verifica su TOTP (aal2)");

  // Origen ajeno: mismas reglas que el resto del panel.
  const ajeno = await fetch(APP + "/api/admin/convocatorias/carga-masiva", { method: "POST", headers: { cookie: adm.cookie(), origin: "https://otro.example.com", "content-type": "application/json" }, body: "{}" });
  ok(ajeno.status === 403, `origen ajeno → 403 (${ajeno.status})`);

  // --- Datos de prueba ---------------------------------------------------------
  const nombreFuente = `Fuente carga ${sufijo}`, nombreCategoria = `Categoría carga ${sufijo}`;
  ({ data: { id: fuenteId } } = await svc.from("fuentes").insert({ nombre: nombreFuente, activa: true }).select("id").single());
  ({ data: { id: categoriaId } } = await svc.from("categorias").insert({ tipo: "sector", nombre: nombreCategoria }).select("id").single());

  // --- Errores del archivo entero ----------------------------------------------
  ok((await api(adm, {})).status === 400, "sin csv → 400");
  const sinCol = await api(adm, { csv: "fuente;nombre\nA;B" });
  ok(sinCol.status === 400 && /entidad_convocante/.test(sinCol.json?.error), `faltan columnas obligatorias → 400 con la lista (${sinCol.json?.error})`);

  // --- Vista previa ------------------------------------------------------------
  const encabezado = "fuente;nombre;entidad_convocante;descripcion;tipo;origen;moneda;monto_minimo;monto_maximo;paises;cobertura_nacional;departamentos;ubicacion_detalle;fecha_apertura;fecha_cierre;url_postulacion;categorias;requisitos_documentos;requisitos_condiciones";
  // fuente en minúsculas y sin tildes: se compara normalizada.
  const fila1 = [nombreFuente.toLowerCase(), `Carga A ${sufijo}`, "Entidad A", "Descripción A", "fondo", "público", "", "1.000.000", "50000000", "CO|México", "no", "05|Bogotá D.C.", "Medellín y Bogotá", "2026-11-01", "15/12/2026", "https://ejemplo.gov.co/a", nombreCategoria.toUpperCase(), "RUT|[opcional] Carta de apoyo", "Tener un año de constituida"].join(";");
  const fila2 = [nombreFuente, `Carga B ${sufijo}`, "Entidad B", "", "beneficio tributario", "cooperacion", "usd", "", "250000", "TODOS", "si", "", "", "", "2027-01-31", "", "", "", ""].join(";");
  const fila3 = ["Fuente que no existe", `Carga C ${sufijo}`, "Entidad C", "", "subsidio", "", "XXX", "", "", "Narnia", "talvez", "Gotham", "", "", "2020-01-01", "", "No existe", "", ""].join(";");
  const fila4 = fila1.replace("Entidad A", "entidad a"); // duplica la 1 dentro del archivo
  const fila5 = [nombreFuente, "Convocatoria de ejemplo para innovación empresarial 2027", "X", "", "", "", "", "", "", "", "", "", "", "", "2026-12-15", "", "", "", ""].join(";");
  const fila6 = [nombreFuente, `Carga F ${sufijo}`, "Entidad F", "", "", "", "", "", "", "CO", "si", "05", "", "", "2026-12-15", "", "", "", ""].join(";");
  const fila7 = [nombreFuente, `Carga G ${sufijo}`, "Entidad G", "", "", "", "", "9.000.000", "1.000", "", "", "", "", "", "2026-12-15", "notaurl", "", "", ""].join(";");
  const csv = "﻿" + [encabezado, fila1, fila2, fila3, fila4, fila5, fila6, fila7, ";;;;;;;;;;;;;;;;;;"].join("\r\n");

  const previa = await api(adm, { csv, confirmar: false });
  const pf = previa.json?.datos?.filas ?? [];
  const porFila = (n) => pf.find((f) => f.numero === n);
  ok(previa.status === 200 && pf.length === 7, `vista previa → 200 con 7 filas, la vacía se salta (${previa.status}, ${pf.length})`);
  ok(previa.json?.datos?.validas === 2 && previa.json?.datos?.creadas === 0 && previa.json?.datos?.confirmado === false, "vista previa: 2 válidas, 0 creadas");
  ok(porFila(2)?.estado === "valida" && porFila(3)?.estado === "valida", "filas 2 y 3 válidas (nombres normalizados, DD/MM/AAAA, TODOS, USD en minúscula)");
  const e4 = porFila(4)?.errores ?? [];
  ok(porFila(4)?.estado === "error" && e4.length === 8, `fila 4: los 8 errores de traducción a la vez (${e4.length}: ${e4.join(" / ")})`);
  ok(porFila(5)?.estado === "duplicada", "fila 5: repite la 2 dentro del archivo → duplicada");
  ok(porFila(6)?.estado === "error" && /ejemplo/.test(porFila(6)?.errores?.[0]), "fila 6: la fila de ejemplo de la plantilla se rechaza");
  ok(porFila(7)?.estado === "error" && /nacional/.test(porFila(7)?.errores?.[0]), "fila 7: nacional con departamentos → la regla del editor (validarFicha)");
  ok(porFila(8)?.estado === "error", `fila 8: mínimo mayor que el máximo o enlace inválido → error del editor (${porFila(8)?.errores?.[0]})`);
  const { count: trasPrevia } = await svc.from("convocatorias").select("id", { count: "exact", head: true }).eq("fuente_id", fuenteId);
  ok(trasPrevia === 0, "la vista previa no crea nada");

  // --- Confirmar ---------------------------------------------------------------
  const conf = await api(adm, { csv, confirmar: true });
  ok(conf.status === 200 && conf.json?.datos?.creadas === 2, `confirmar → 2 creadas (${conf.status}, ${conf.json?.datos?.creadas})`);
  const creadas = (conf.json?.datos?.filas ?? []).filter((f) => f.estado === "creada");
  ok(creadas.every((f) => /^[0-9a-f-]{36}$/.test(f.id)), "cada creada devuelve su id");

  const { data: a } = await svc
    .from("convocatorias")
    .select("estado, creado_por, moneda, monto_min, monto_max, origen, tipo_convocatoria, fecha_apertura, fecha_cierre, cobertura_nacional, todos_los_paises, url_postulacion, ubicacion_cobertura, convocatoria_pais (pais_codigo), convocatoria_departamento (departamento_codigo), convocatoria_categoria (categoria_id), requisitos_convocatoria (descripcion, tipo, obligatorio)")
    .eq("nombre", `Carga A ${sufijo}`).single();
  ok(a?.estado === "borrador" && a.creado_por === uAdmin.user.id, "fila A: en borrador y creada por el administrador (nunca publica)");
  ok(a?.moneda === "COP" && Number(a.monto_min) === 1000000 && Number(a.monto_max) === 50000000, "fila A: COP por defecto y montos con y sin puntos");
  ok(a?.origen === "publico" && a.tipo_convocatoria === "fondo" && a.fecha_apertura === "2026-11-01" && a.fecha_cierre === "2026-12-15", "fila A: origen «público» con tilde, tipo y fechas");
  ok(JSON.stringify(a?.convocatoria_pais.map((p) => p.pais_codigo).sort()) === '["CO","MX"]', "fila A: países por código y por nombre con tilde (RN-39)");
  ok(JSON.stringify(a?.convocatoria_departamento.map((d) => d.departamento_codigo).sort()) === '["05","11"]', "fila A: departamentos por código y por nombre (RN-34)");
  ok(a?.convocatoria_categoria.length === 1 && a.convocatoria_categoria[0].categoria_id === categoriaId, "fila A: categoría por nombre en mayúsculas");
  const req = a?.requisitos_convocatoria ?? [];
  ok(req.length === 3 && req.find((r) => r.descripcion === "Carta de apoyo")?.obligatorio === false && req.find((r) => r.descripcion === "RUT")?.obligatorio === true && req.some((r) => r.tipo === "condicion"),
    "fila A: 3 requisitos, el [opcional] no obligatorio, documentos y condiciones");

  const { data: b } = await svc.from("convocatorias").select("estado, moneda, monto_max, todos_los_paises, cobertura_nacional, tipo_convocatoria, origen").eq("nombre", `Carga B ${sufijo}`).single();
  ok(b?.estado === "borrador" && b.moneda === "USD" && Number(b.monto_max) === 250000 && b.todos_los_paises && b.cobertura_nacional && b.tipo_convocatoria === "beneficio_tributario" && b.origen === "cooperacion",
    "fila B: USD en su moneda (RN-40), todos los países, nacional, beneficio tributario y cooperación");

  // La empresa no ve los borradores (RN-33).
  const { data: vistas } = await emp.cliente.from("convocatorias").select("id").eq("fuente_id", fuenteId);
  ok((vistas ?? []).length === 0, "empresa no ve los borradores cargados");

  // --- Idempotencia: el mismo archivo otra vez no duplica ----------------------
  const otra = await api(adm, { csv, confirmar: true });
  const dup = (otra.json?.datos?.filas ?? []).filter((f) => f.estado === "duplicada").length;
  ok(otra.status === 200 && otra.json?.datos?.creadas === 0 && dup === 3, `subir el mismo archivo otra vez → 0 creadas, 3 duplicadas (${otra.json?.datos?.creadas}, ${dup})`);
  const { count: alFinal } = await svc.from("convocatorias").select("id", { count: "exact", head: true }).eq("fuente_id", fuenteId);
  ok(alFinal === 2, `en la base siguen 2 (${alFinal})`);

  // --- Documentos (sesión 035): la columna se cruza con los archivos elegidos ---
  const encDocs = "fuente;nombre;entidad_convocante;fecha_cierre;documentos";
  const csvDocs = [
    encDocs,
    `${nombreFuente};Carga H ${sufijo};Entidad H;2026-12-15;tdr-h.pdf=TDR|Anexo-H.docx=anexo`,
    `${nombreFuente};Carga I ${sufijo};Entidad I;2026-12-15;falta.pdf|grande.pdf|foto.png|x.pdf=otro`,
  ].join("\n");
  const elegidos = [
    { nombre: "TDR-H.pdf", tamanoBytes: 1000 },
    { nombre: "anexo-h.docx", tamanoBytes: 2000 },
    { nombre: "grande.pdf", tamanoBytes: 21 * 1024 * 1024 },
    { nombre: "x.pdf", tamanoBytes: 10 },
    { nombre: "sobra.pdf", tamanoBytes: 10 },
  ];
  ok((await api(adm, { csv: csvDocs, archivos: "nada" })).status === 400, "lista de archivos con forma inválida → 400");
  const pd = await api(adm, { csv: csvDocs, archivos: elegidos });
  const h = pd.json?.datos?.filas?.find((f) => f.numero === 2), i = pd.json?.datos?.filas?.find((f) => f.numero === 3);
  ok(h?.estado === "valida" && JSON.stringify(h.documentos) === '[{"archivo":"TDR-H.pdf","tipo":"TDR"},{"archivo":"anexo-h.docx","tipo":"anexo"}]',
    `fila H: documentos cruzados sin distinguir mayúsculas, con el nombre real y su tipo (${JSON.stringify(h?.documentos)})`);
  ok(i?.estado === "error" && i.errores.length === 4, `fila I: no elegido, más de 20 MB, formato y tipo inválidos → 4 errores (${i?.errores?.join(" / ")})`);
  ok(JSON.stringify(pd.json?.datos?.archivosSinUsar) === '["sobra.pdf"]', `archivo que ninguna fila nombra → avisado (${JSON.stringify(pd.json?.datos?.archivosSinUsar)})`);
  const sinElegir = await api(adm, { csv: csvDocs });
  ok(sinElegir.json?.datos?.filas?.[0]?.estado === "error", "con documentos en el CSV pero sin elegir archivos → la fila no se crea");

  const cd = await api(adm, { csv: csvDocs, archivos: elegidos, confirmar: true });
  const creadaH = cd.json?.datos?.filas?.find((f) => f.numero === 2);
  ok(cd.json?.datos?.creadas === 1 && creadaH?.estado === "creada" && creadaH.documentos.length === 2, "confirmar: se crea H y devuelve sus documentos para subirlos");

  // La subida de la pantalla: firma, archivo al bucket y registro (RF-07), al borrador recién creado.
  const base = `/api/admin/convocatorias/${creadaH.id}/documentos`;
  const post = (ruta, cuerpo) => fetch(APP + ruta, { method: "POST", headers: { "content-type": "application/json", origin: APP, cookie: adm.cookie() }, body: JSON.stringify(cuerpo) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
  const firma = await post(`${base}/subida`, { nombre: "TDR-H", tipo: "TDR", extension: "pdf", tamanoBytes: 20 });
  const { error: eSub } = await adm.cliente.storage.from("documentos-convocatorias").uploadToSignedUrl(firma.json?.datos?.ruta, firma.json?.datos?.token, new Blob(["%PDF-1.4 prueba"], { type: "application/pdf" }), { contentType: "application/pdf" });
  const reg = await post(base, { documentoId: firma.json?.datos?.documentoId, nombre: "TDR-H", tipo: "TDR", extension: "pdf" });
  ok(firma.status === 200 && !eSub && reg.status === 200, `documento subido y registrado en el borrador creado (${firma.status}, ${eSub?.message ?? "ok"}, ${reg.status})`);
  const { data: docsH } = await svc.from("documentos_convocatoria").select("tipo_doc, nombre").eq("convocatoria_id", creadaH.id);
  ok(docsH?.length === 1 && docsH[0].tipo_doc === "TDR", "la convocatoria H queda con su TDR adjunto");

  // --- Enlaces (sesión 036): la columna admite enlaces y el servidor los descarga (RNF-37) ---
  const PDF_PUBLICO = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
  const csvEnlaces = [
    encDocs,
    `${nombreFuente};Carga J ${sufijo};Entidad J;2026-12-15;${PDF_PUBLICO}|https://portal.example.gov.co/descarga?id=55&doc=7=anexo`,
    `${nombreFuente};Carga K ${sufijo};Entidad K;2026-12-15;https://sin punto/tdr.pdf`,
  ].join("\n");
  const pe = await api(adm, { csv: csvEnlaces });
  const j = pe.json?.datos?.filas?.find((f) => f.numero === 2), k = pe.json?.datos?.filas?.find((f) => f.numero === 3);
  ok(j?.estado === "valida" && JSON.stringify(j.documentos) === JSON.stringify([{ enlace: PDF_PUBLICO, tipo: "TDR" }, { enlace: "https://portal.example.gov.co/descarga?id=55&doc=7", tipo: "anexo" }]),
    `fila J: enlaces sin tipo (TDR) y con «=» en la consulta y tipo al final (${JSON.stringify(j?.documentos)})`);
  ok(k?.estado === "error" && /no es un enlace válido/.test(k.errores[0]), `fila K: enlace mal formado → error (${k?.errores?.[0]})`);

  const ce = await api(adm, { csv: csvEnlaces, confirmar: true });
  const creadaJ = ce.json?.datos?.filas?.find((f) => f.numero === 2);
  ok(ce.json?.datos?.creadas === 1 && creadaJ?.id, "confirmar: se crea J");
  const desde = (s, cuerpo, idConv = creadaJ.id, origen = APP) => fetch(`${APP}/api/admin/convocatorias/${idConv}/documentos/desde-enlace`, { method: "POST", headers: { "content-type": "application/json", origin: origen, ...(s && { cookie: s.cookie() }) }, body: JSON.stringify(cuerpo) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
  ok((await desde(null, { url: PDF_PUBLICO, tipo: "TDR" })).status === 404, "desde-enlace · anónimo → 404");
  ok((await desde(emp, { url: PDF_PUBLICO, tipo: "TDR" })).status === 404, "desde-enlace · empresa → 404");
  ok((await desde(adm, { url: PDF_PUBLICO, tipo: "TDR" }, creadaJ.id, "https://otro.example.com")).status === 403, "desde-enlace · origen ajeno → 403");
  for (const interna of ["http://169.254.169.254/latest/meta-data/", "http://127.0.0.1.nip.io/", "http://localhost/", "http://[::1]/"]) {
    const r = await desde(adm, { url: interna, tipo: "TDR" });
    ok(r.status === 422 && /interna/.test(r.json?.error), `desde-enlace · ${interna} → 422 dirección interna (${r.status})`);
  }
  const html = await desde(adm, { url: "https://example.com/", tipo: "TDR" });
  ok(html.status === 422 && /no entrega un PDF/.test(html.json?.error), `desde-enlace · página HTML → 422 (${html.json?.error})`);
  const real = await desde(adm, { url: PDF_PUBLICO, tipo: "TDR" });
  ok(real.status === 200 && real.json?.datos?.nombre === "dummy" && real.json?.datos?.tipoMime === "application/pdf", `desde-enlace · PDF público → 200, registrado como «dummy» (${real.status} ${real.json?.error ?? ""})`);
  const { data: docsJ } = await svc.from("documentos_convocatoria").select("tipo_doc, tamano_bytes, storage_path").eq("convocatoria_id", creadaJ.id);
  ok(docsJ?.length === 1 && Number(docsJ[0].tamano_bytes) > 10000 && docsJ[0].storage_path.endsWith(".pdf"), "la convocatoria J queda con el PDF descargado en el bucket");

  // --- Fuentes no registradas (sesión 037, CU-50 4d) ----------------------------
  const nueva = `Fuente nueva ${sufijo}`, inactiva = `Fuente inactiva ${sufijo}`;
  const { data: fi } = await svc.from("fuentes").insert({ nombre: inactiva, activa: false }).select("id").single();
  fuentesExtra.push(fi.id);
  const csvFuentes = [
    "fuente;nombre;entidad_convocante;fecha_cierre",
    `${nueva};Carga L ${sufijo};Entidad L;2026-12-15`,
    `${nueva.toUpperCase()};Carga M ${sufijo};Entidad M;2026-12-15`,
    `${inactiva};Carga N ${sufijo};Entidad N;2026-12-15`,
  ].join("\n");
  const pf1 = await api(adm, { csv: csvFuentes });
  ok(JSON.stringify(pf1.json?.datos?.fuentesNuevas) === JSON.stringify([{ nombre: nueva, filas: [2, 3] }]),
    `fuente nueva listada una sola vez, sin distinguir mayúsculas, con sus filas (${JSON.stringify(pf1.json?.datos?.fuentesNuevas)})`);
  ok(JSON.stringify(pf1.json?.datos?.fuentesInactivas) === JSON.stringify([{ nombre: inactiva, filas: [4] }]), "fuente inactiva listada aparte");
  const filaL = pf1.json?.datos?.filas?.[0];
  ok(filaL?.estado === "error" && /no está registrada/.test(filaL.errores[0]) && /inactiva/.test(pf1.json?.datos?.filas?.[2]?.errores?.[0]), "cada fila dice si su fuente falta o está inactiva");
  const regFuente = await fetch(APP + "/api/admin/fuentes", { method: "POST", headers: { "content-type": "application/json", origin: APP, cookie: adm.cookie() }, body: JSON.stringify({ nombre: nueva, tipoEntidad: "Fundación", url: "", activa: true }) }).then((r) => r.json());
  if (regFuente?.datos?.id) fuentesExtra.push(regFuente.datos.id);
  ok(regFuente?.ok && regFuente.datos.nombre === nueva, "registrar la fuente con el endpoint de Fuentes (RF-04)");
  const pf2 = await api(adm, { csv: csvFuentes });
  ok(pf2.json?.datos?.validas === 2 && pf2.json?.datos?.fuentesNuevas.length === 0 && pf2.json?.datos?.fuentesInactivas.length === 1,
    `al volver a revisar, las 2 filas de la fuente registrada quedan listas y la inactiva sigue señalada (${pf2.json?.datos?.validas})`);
} finally {
  for (const id of fuentesExtra) {
    await svc.from("convocatorias").delete().eq("fuente_id", id);
    await svc.from("fuentes").delete().eq("id", id);
  }
  if (fuenteId) {
    const { data: creadasPrueba } = await svc.from("convocatorias").select("id").eq("fuente_id", fuenteId);
    for (const { id } of creadasPrueba ?? []) {
      const { data: objetos } = await svc.storage.from("documentos-convocatorias").list(id);
      if (objetos?.length) await svc.storage.from("documentos-convocatorias").remove(objetos.map((o) => `${id}/${o.name}`));
    }
  }
  if (fuenteId) await svc.from("convocatorias").delete().eq("fuente_id", fuenteId);
  if (categoriaId) await svc.from("categorias").delete().eq("id", categoriaId);
  if (fuenteId) await svc.from("fuentes").delete().eq("id", fuenteId);
  for (const id of cuentas) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (invitaciones.length) await svc.from("invitaciones_admin").delete().in("id", invitaciones);
  console.log("datos y cuentas de prueba borrados");
}
console.log(fallas ? `${fallas} FALLAS` : "TODO PASÓ");
process.exitCode = fallas ? 1 : 0;
