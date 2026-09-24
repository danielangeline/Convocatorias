// Prueba de la bandeja de revisión y la administración de consultores contra
// Supabase real (RF-34, RF-35, CU-25, CU-27, RN-13, RN-29, RNF-16, RF-85 ·
// docs/05 §9.21 · Sprint 4 paso 1b).
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-revision-consultores.mjs
//
// Crea sus propias cuentas temporales —un administrador por la vía real de
// invitación, con MFA verificado; tres consultores con foto y hoja de vida de
// verdad; una empresa— y una categoría. Los encargos del consultor que se
// suspende se siembran con service_role: los encargos siguen en el store hasta
// el paso 3. Borra todo al terminar.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import crypto from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.PRUEBA_URL ?? "http://localhost:3000";
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
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
  return { status: r.status, json, texto };
}
const b32 = (s) => { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const ch of s) bits += a.indexOf(ch).toString(2).padStart(5, "0"); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); };
const desfase = new Date((await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })).headers.get("date")).getTime() - Date.now();
const totp = (sec) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor((Date.now() + desfase) / 30000))); const h = crypto.createHmac("sha1", b32(sec)).update(c).digest(); const k = h[h.length - 1] & 15; return String((h.readUInt32BE(k) & 0x7fffffff) % 1e6).padStart(6, "0"); };

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const sufijo = crypto.randomBytes(3).toString("hex");
const pdfDe = (quien) => Buffer.from(`%PDF-1.4\n% hoja de vida de ${quien} ${sufijo}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`);
const cuentas = [], categorias = [], invitaciones = [];

async function subir(s, tipo, cuerpo, contentType) {
  const firma = await api(s, "POST", "/api/consultor/perfil/archivos/subida", { tipo, nombreArchivo: tipo === "foto" ? "foto.png" : "cv.pdf", tamanoBytes: cuerpo.length });
  const bucket = tipo === "foto" ? "fotos-consultores" : "hojas-de-vida";
  await s.cliente.storage.from(bucket).uploadToSignedUrl(firma.json.datos.ruta, firma.json.datos.token, cuerpo, { contentType });
  return api(s, "POST", "/api/consultor/perfil/archivos", { tipo, ruta: firma.json.datos.ruta });
}

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre, extra = {}) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.revision.${sufijo}@example.com`, password: clave, email_confirm: true,
      user_metadata: { rol, nombre, ...extra },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    const s = sesion();
    const { error: e } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (e) throw e;
    s.id = data.user.id;
    return s;
  };

  // --- Administrador por invitación, con MFA ---------------------------------------
  const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
  const correoAdmin = `admin.revision.${sufijo}@example.com`;
  const { data: invId } = await svc.rpc("crear_invitacion_admin", { p_propietario: propietario.id, p_correo: correoAdmin, p_nombre: "Admin revisión" });
  invitaciones.push(invId);
  const { data: uAdmin } = await svc.auth.admin.createUser({ email: correoAdmin, password: clave, email_confirm: true });
  cuentas.push(uAdmin.user.id);
  await svc.rpc("aceptar_invitacion_admin", { p_invitacion: invId, p_usuario: uAdmin.user.id });
  const adm = sesion();
  await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: clave });
  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  ok(!eMfa, `administrador verifica su TOTP (aal2) ${eMfa?.message ?? ""}`);

  // --- Tres consultores en revisión y una empresa ----------------------------------
  const { data: cat } = await svc.from("categorias").insert({ tipo: "sector", nombre: `Sector revisión ${sufijo}`, activa: true }).select("id").single();
  categorias.push(cat.id);
  const emp = await crearCuenta("empresa", "empresa", { nombre_empresa: "Empresa revisión", consentimiento_datos: true });

  const consultor = async (letra) => {
    const s = await crearCuenta("consultor", `consultor-${letra}`, { consentimiento_datos: true });
    s.nombre = `Consultor ${letra.toUpperCase()} ${sufijo}`;
    await api(s, "PATCH", "/api/consultor/perfil", {
      nombreProfesional: s.nombre, descripcion: `Formulo proyectos (${letra})`, sitioWeb: `https://${letra}-${sufijo}.co`,
      especialidades: [cat.id], redes: [{ tipo: "linkedin", url: `https://linkedin.com/in/${letra}-${sufijo}` }],
      portafolio: [{ nombreProyecto: `Proyecto de ${letra}`, entidad: "MinCiencias", anio: 2024 }],
    });
    await subir(s, "foto", PNG, "image/png");
    await subir(s, "cv", pdfDe(letra), "application/pdf");
    const r = await api(s, "POST", "/api/consultor/perfil/enviar-revision", {});
    if (r.status !== 200) throw new Error(`no se pudo enviar ${letra} a revisión: ${r.status} ${r.texto.slice(0, 200)}`);
    return s;
  };
  const a = await consultor("a"), b = await consultor("b"), c = await consultor("c");
  const d = await crearCuenta("consultor", "consultor-d", { consentimiento_datos: true });  // incompleto, sin hoja de vida

  const base = "/api/admin/consultores";

  // --- RF-85: el panel no existe para los demás --------------------------------------
  for (const [quien, s] of [["anónimo", null], ["empresa", emp], ["consultor", a]]) {
    const r1 = await api(s, "GET", `${base}?estado=en_revision`);
    const r2 = await api(s, "POST", `${base}/${b.id}/aprobar`, {});
    const r3 = await api(s, "GET", `${base}/${b.id}/cv`);
    ok(r1.status === 404 && r2.status === 404 && r3.status === 404, `${quien}: listar, aprobar y ver hoja de vida -> 404 (${r1.status}, ${r2.status}, ${r3.status})`);
  }
  ok((await api(adm, "POST", `${base}/${b.id}/aprobar`, {}, { origen: "https://otro.example" })).status === 403, "administrador desde otro origen -> 403");
  ok((await api(adm, "POST", `${base}/no-es-uuid/aprobar`, {})).status === 404, "id que no es uuid -> 404");
  ok((await api(adm, "POST", `${base}/${crypto.randomUUID()}/aprobar`, {})).status === 404, "perfil inexistente -> 404");
  ok((await api(adm, "GET", `${base}?estado=raro`)).status === 400, "estado de filtro inválido -> 400");

  // --- CU-25 paso 2: la bandeja ------------------------------------------------------
  const bandeja = await api(adm, "GET", `${base}?estado=en_revision`);
  const enBandeja = (bandeja.json?.datos ?? []).filter((x) => [a.id, b.id, c.id].includes(x.id));
  ok(bandeja.status === 200 && enBandeja.length === 3, `la bandeja trae a los tres en revisión (${enBandeja.length})`);
  ok(!(bandeja.json?.datos ?? []).some((x) => x.id === d.id), "un perfil incompleto no está en la bandeja");
  const fichaB = enBandeja.find((x) => x.id === b.id);
  ok(fichaB && fichaB.sitioWeb === `https://b-${sufijo}.co` && fichaB.redes.length === 1 && fichaB.portafolio.length === 1
     && fichaB.especialidades[0]?.id === cat.id && fichaB.tieneHojaDeVida && /^https:\/\/.+\/sign\/fotos-consultores\//.test(fichaB.fotoUrl ?? ""),
    "la ficha trae sitio web, redes, portafolio, especialidad, hoja de vida y foto firmada");
  ok(fichaB && !("cvPath" in fichaB) && !JSON.stringify(fichaB).includes("hojas-de-vida"), "la ficha no expone la ruta de la hoja de vida");

  // --- RNF-16: hoja de vida por URL firmada --------------------------------------------
  const cvB = await api(adm, "GET", `${base}/${b.id}/cv`);
  const url = cvB.json?.datos?.url ?? "";
  const descarga = url ? await fetch(url) : null;
  const contenido = descarga ? Buffer.from(await descarga.arrayBuffer()).toString() : "";
  ok(cvB.status === 200 && url.includes(`/sign/hojas-de-vida/${b.id}/`) && contenido.includes(`hoja de vida de b ${sufijo}`),
    "el administrador abre la hoja de vida de B: URL firmada de su carpeta y el archivo exacto");
  ok(new URL(url).searchParams.get("download")?.includes(b.nombre), "la descarga lleva el nombre del consultor");
  ok((await api(adm, "GET", `${base}/${d.id}/cv`)).status === 404, "consultor sin hoja de vida -> 404");
  const rutaB = url ? decodeURIComponent(new URL(url).pathname.split("/sign/hojas-de-vida/")[1]) : "";
  const { error: eEmpFirma } = await emp.cliente.storage.from("hojas-de-vida").createSignedUrl(rutaB, 60);
  ok(Boolean(eEmpFirma), "la empresa no puede firmar la hoja de vida desde Storage");
  const { error: eAFirma } = await a.cliente.storage.from("hojas-de-vida").createSignedUrl(rutaB, 60);
  ok(Boolean(eAFirma), "otro consultor tampoco");

  // --- RF-34 y RN-13: rechazar ---------------------------------------------------------
  ok((await api(adm, "POST", `${base}/${b.id}/rechazar`, { motivo: "   " })).status === 400, "rechazar sin motivo -> 400");
  const rechazo = await api(adm, "POST", `${base}/${b.id}/rechazar`, { motivo: "Falta detallar el portafolio" });
  ok(rechazo.status === 200 && /rechazado/i.test(rechazo.json?.aviso ?? ""), `rechazar con motivo -> 200 (${rechazo.status})`);
  ok((await api(adm, "POST", `${base}/${b.id}/aprobar`, {})).status === 409, "aprobar un perfil ya revisado -> 409 (CU-25 3a)");
  const perfilB = await api(b, "GET", "/api/consultor/perfil");
  ok(perfilB.json?.datos?.estadoPerfil === "rechazado" && perfilB.json?.datos?.motivoRechazo === "Falta detallar el portafolio",
    "el consultor B ve su rechazo y el motivo");
  const reenvio = await api(b, "POST", "/api/consultor/perfil/enviar-revision", {});
  ok(reenvio.status === 200, `B reenvía sin límite (RN-13) -> ${reenvio.status}`);
  const pantallaBandeja = await api(adm, "GET", "/admin/consultores/revision");
  ok(pantallaBandeja.status === 200 && pantallaBandeja.texto.includes(b.nombre) && pantallaBandeja.texto.includes("Falta detallar el portafolio"),
    "la bandeja en pantalla muestra el reenvío con el motivo anterior");

  // --- RF-34: aprobar ------------------------------------------------------------------
  const aprobado = await api(adm, "POST", `${base}/${a.id}/aprobar`, {});
  ok(aprobado.status === 200, `aprobar A -> ${aprobado.status}`);
  ok((await api(adm, "POST", `${base}/${a.id}/aprobar`, {})).status === 409, "aprobar dos veces -> 409");
  ok((await api(adm, "POST", `${base}/${a.id}/rechazar`, { motivo: "tarde" })).status === 409, "rechazar uno ya aprobado -> 409");
  const { data: filaA } = await svc.from("consultor_perfiles").select("estado_perfil, revisado_por, revisado_at").eq("id", a.id).single();
  ok(filaA.estado_perfil === "aprobado" && filaA.revisado_por === uAdmin.user.id && filaA.revisado_at, "A queda aprobado con revisor y fecha");
  const { count: susA } = await svc.from("suscripciones").select("id", { count: "exact", head: true }).eq("usuario_id", a.id);
  ok(susA === 0, "aprobar no crea suscripción hasta el Sprint 5 (RN-11 transitorio)");
  const { data: publicoA } = await anon.from("consultor_perfiles").select("id").eq("id", a.id);
  ok(publicoA?.length === 1, "A aprobado ya es visible para cualquiera (directorio, RN-08)");

  // --- RF-35 y RN-29: suspender -------------------------------------------------------
  ok((await api(adm, "POST", `${base}/${c.id}/suspender`, { motivo: "x" })).status === 409, "suspender uno en revisión -> 409");
  await api(adm, "POST", `${base}/${c.id}/aprobar`, {});
  const { data: proyecto } = await svc.from("proyectos").insert({ usuario_id: emp.id, nombre: `Proyecto revisión ${sufijo}` }).select("id").single();
  const encargo = (titulo, estado) => ({ proyecto_id: proyecto.id, empresa_id: emp.id, consultor_id: c.id, titulo_tarea: titulo, via: "directorio", estado, tipo_ayuda: "buscar_convocatoria" });
  const { error: eSiembra } = await svc.from("encargos").insert([encargo("En curso", "en_curso"), encargo("Pendiente", "pendiente"), encargo("Completado", "completado")]);
  ok(!eSiembra, `encargos sembrados para C ${eSiembra?.message ?? ""}`);
  const listado = await api(adm, "GET", base);
  const filaC = (listado.json?.datos ?? []).find((x) => x.id === c.id);
  ok(filaC?.encargosActivos === 2, `el listado cuenta 2 encargos activos de C (${filaC?.encargosActivos})`);

  // RF-80: antes de suspender, la empresa con solicitud activa ve el contacto.
  const { data: contactoAntes } = await emp.cliente.rpc("contacto_consultor", { p_consultor: c.id });
  ok(contactoAntes?.length === 1, "con encargos activos, la empresa ve el contacto de C (RF-80)");

  ok((await api(adm, "POST", `${base}/${c.id}/suspender`, {})).status === 400, "suspender sin motivo -> 400");
  const suspension = await api(adm, "POST", `${base}/${c.id}/suspender`, { motivo: "Incumplió los plazos acordados" });
  ok(suspension.status === 200 && suspension.json?.datos?.cancelados === 2 && /2 encargos/.test(suspension.json?.aviso ?? ""),
    `suspender C -> 200, 2 encargos cancelados ("${suspension.json?.aviso}")`);
  const { data: encargosC } = await svc.from("encargos").select("titulo_tarea, estado, motivo_cancelacion").eq("consultor_id", c.id).order("titulo_tarea");
  ok(encargosC.map((e) => `${e.titulo_tarea}=${e.estado}`).join(", ") === "Completado=completado, En curso=cancelado, Pendiente=cancelado"
     && encargosC.filter((e) => e.estado === "cancelado").every((e) => e.motivo_cancelacion === "Consultor suspendido por el administrador"),
    "en curso y pendiente pasan a cancelado con el motivo fijo; el completado no se toca (RN-29)");
  const { data: contactoDespues } = await emp.cliente.rpc("contacto_consultor", { p_consultor: c.id });
  ok((contactoDespues ?? []).length === 0, "tras suspender, la empresa ya no ve el contacto de C (RF-80)");
  ok((await api(adm, "POST", `${base}/${c.id}/suspender`, { motivo: "otra" })).status === 409, "suspender dos veces -> 409");

  const { data: publicoC } = await anon.from("consultor_perfiles").select("id").eq("id", c.id);
  ok((publicoC ?? []).length === 0, "C suspendido sale del directorio");
  const perfilC = await api(c, "GET", "/api/consultor/perfil");
  ok(perfilC.json?.datos?.estadoPerfil === "suspendido" && perfilC.json?.datos?.motivoSuspension === "Incumplió los plazos acordados",
    "el consultor C ve que está suspendido y por qué");
  const pantallaC = await api(c, "GET", "/consultor/perfil");
  ok(pantallaC.status === 200 && pantallaC.texto.includes("Incumplió los plazos acordados"), "y el motivo aparece en su pantalla");
  const { error: eEmpMotivo } = await emp.cliente.from("consultor_perfiles").select("motivo_suspension").eq("id", c.id);
  ok(Boolean(eEmpMotivo), "la empresa no puede leer el motivo de la suspensión");
  const { error: eEmpSuspende } = await emp.cliente.rpc("suspender_consultor", { p_id: a.id, p_motivo: "x" });
  ok(Boolean(eEmpSuspende), "la empresa no puede llamar a la función de suspender");
  const { error: eDirecto } = await adm.cliente.from("consultor_perfiles").update({ estado_perfil: "aprobado" }).eq("id", c.id);
  ok(Boolean(eDirecto), "ni el administrador cambia el estado con un update directo");
  const pantallaLista = await api(adm, "GET", "/admin/consultores");
  ok(pantallaLista.status === 200 && pantallaLista.texto.includes(c.nombre) && pantallaLista.texto.includes("Reactivar"),
    "la lista del panel ofrece reactivar a C");

  // --- RF-35 y CU-27 3a: reactivar ------------------------------------------------------
  const reactivado = await api(adm, "POST", `${base}/${c.id}/reactivar`, {});
  ok(reactivado.status === 200, `reactivar C -> ${reactivado.status}`);
  ok((await api(adm, "POST", `${base}/${c.id}/reactivar`, {})).status === 409, "reactivar dos veces -> 409");
  const { data: filaC2 } = await svc.from("consultor_perfiles").select("estado_perfil, motivo_suspension").eq("id", c.id).single();
  ok(filaC2.estado_perfil === "aprobado" && filaC2.motivo_suspension === null, "C vuelve a aprobado y sin motivo");
  const { count: cancelados } = await svc.from("encargos").select("id", { count: "exact", head: true }).eq("consultor_id", c.id).eq("estado", "cancelado");
  ok(cancelados === 2, "reactivar no revive los encargos cancelados");

  // --- RNF-30: pantallas -----------------------------------------------------------------
  ok((await api(emp, "GET", "/admin/consultores")).status === 404, "empresa en /admin/consultores -> 404");
  ok((await api(a, "GET", "/admin/consultores/revision")).status === 404, "consultor en /admin/consultores/revision -> 404");
} catch (e) {
  fallas++;
  console.error("FALLA inesperada:", e);
} finally {
  if (cuentas.length) {
    await svc.from("encargos").delete().in("empresa_id", cuentas);
    await svc.from("proyectos").delete().in("usuario_id", cuentas);
  }
  for (const id of [...cuentas].reverse()) {  // el administrador figura como revisor: se borra al final
    for (const bucket of ["fotos-consultores", "hojas-de-vida"]) {
      const { data } = await svc.storage.from(bucket).list(id);
      if (data?.length) await svc.storage.from(bucket).remove(data.map((o) => `${id}/${o.name}`));
    }
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (categorias.length) await svc.from("categorias").delete().in("id", categorias);
  if (invitaciones.length) await svc.from("invitaciones_admin").delete().in("id", invitaciones);
  console.log(fallas === 0 ? "\nTODO PASA" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
