// Prueba de los encargos de punta a punta contra Supabase real (RF-28..33,
// RF-68..70, RF-74, RF-89, RF-90, RN-09, RN-25, RN-26, RN-36, RNF-30 · CU-18,
// 19, 22, 23, 24, 26 · docs/05 §9.23 · Sprint 4 paso 3).
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-encargos.mjs
//
// Crea sus propias cuentas temporales: dos empresas, tres consultores (dos
// aprobados externos y uno del equipo interno) y un administrador por la vía
// real de invitación, con MFA verificado. Todo lo demás pasa por la API, como
// en las pantallas. Borra todo al terminar.
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
const cuentas = [], categorias = [], convocatorias = [], invitaciones = [];
const hoy = new Date(Date.now() - 5 * 3600 * 1000);  // Colombia
const enDias = (n) => new Date(hoy.getTime() + n * 86400000).toISOString().slice(0, 10);

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre, extra = {}) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.encargos.${sufijo}@example.com`, password: clave, email_confirm: true,
      user_metadata: { rol, nombre, ...extra },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    const s = sesion();
    const { error: e } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (e) throw e;
    s.id = data.user.id;
    s.correo = data.user.email;
    return s;
  };

  // --- Administrador por invitación, con MFA ---------------------------------------
  const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
  const correoAdmin = `admin.encargos.${sufijo}@example.com`;
  const { data: invId } = await svc.rpc("crear_invitacion_admin", { p_propietario: propietario.id, p_correo: correoAdmin, p_nombre: "Admin encargos" });
  invitaciones.push(invId);
  const { data: uAdmin } = await svc.auth.admin.createUser({ email: correoAdmin, password: clave, email_confirm: true });
  cuentas.push(uAdmin.user.id);
  await svc.rpc("aceptar_invitacion_admin", { p_invitacion: invId, p_usuario: uAdmin.user.id });
  const adm = sesion();
  await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: clave });
  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  ok(!eMfa, `administrador verifica su TOTP (aal2) ${eMfa?.message ?? ""}`);

  // --- Empresas, consultores, catálogo y proyecto ---------------------------------
  const nombreE1 = `Empresa Uno ${sufijo}`;
  const e1 = await crearCuenta("empresa", "empresa1", { nombre_empresa: nombreE1, consentimiento_datos: true });
  const e2 = await crearCuenta("empresa", "empresa2", { nombre_empresa: `Empresa Dos ${sufijo}`, consentimiento_datos: true });
  const consultor = async (letra, nombre, extra = {}) => {
    const s = await crearCuenta("consultor", `consultor-${letra}`, { consentimiento_datos: true });
    s.nombre = nombre;
    const { error } = await svc.from("consultor_perfiles")
      .update({ nombre_profesional: nombre, descripcion: `Consultor ${letra}`, estado_perfil: "aprobado", ...extra }).eq("id", s.id);
    if (error) throw error;
    return s;
  };
  const a = await consultor("a", `Ana Consultora ${sufijo}`);
  const b = await consultor("b", `Interno Beta ${sufijo}`, { es_equipo_interno: true });
  const c = await consultor("c", `Carlos Consultor ${sufijo}`);

  const { data: cat } = await svc.from("categorias").insert({ tipo: "sector", nombre: `Sector encargos ${sufijo}`, activa: true }).select("id").single();
  categorias.push(cat.id);
  const { data: conv, error: eConv } = await svc.from("convocatorias").insert({
    nombre: `Convocatoria encargos ${sufijo}`, entidad_convocante: "Entidad de prueba", cobertura_nacional: true,
    fecha_cierre: enDias(20), estado: "publicada", url_postulacion: "https://prueba.gov.co/encargos",
  }).select("id").single();
  if (eConv) throw eConv;
  convocatorias.push(conv.id);
  await svc.from("requisitos_convocatoria").insert([
    { convocatoria_id: conv.id, descripcion: "RUT actualizado", tipo: "documento", obligatorio: true, orden: 0 },
    { convocatoria_id: conv.id, descripcion: "Carta de intención", tipo: "documento", obligatorio: false, orden: 1 },
  ]);
  const { data: p1 } = await svc.from("proyectos").insert({
    usuario_id: e1.id, nombre: `Proyecto encargos ${sufijo}`, problema: `Problema del proyecto ${sufijo}`,
    monto_buscado: 50000000, departamento_codigo: "08",
  }).select("id").single();
  await svc.from("proyecto_categoria").insert({ proyecto_id: p1.id, categoria_id: cat.id });
  const { data: p2 } = await svc.from("proyectos").insert({ usuario_id: e2.id, nombre: `Proyecto ajeno ${sufijo}` }).select("id").single();
  const post = await api(e1, "POST", "/api/postulaciones", { convocatoriaId: conv.id, proyectoId: p1.id });
  ok(post.status === 201, `la empresa inicia la postulación del par (${post.status})`);

  // --- RNF-30: cada lado su puerta -----------------------------------------------
  const anon = await api(null, "GET", "/api/encargos");
  ok(anon.status === 307 && /\/login/.test(anon.destino ?? ""), `anónimo -> redirige a /login (${anon.status})`);
  ok((await api(a, "GET", "/api/encargos")).status === 403, "consultor en /api/encargos -> 403");
  ok((await api(e1, "GET", "/api/consultor/encargos")).status === 403, "empresa en /api/consultor/encargos -> 403");
  ok((await api(e1, "GET", "/api/admin/encargos")).status === 404 && (await api(a, "GET", "/api/admin/encargos")).status === 404,
    "empresa y consultor en /api/admin/encargos -> 404");
  const base = { proyectoId: p1.id, tipoAyuda: "convocatoria_especifica", convocatoriaId: conv.id, titulo: `Estructurar la postulación ${sufijo}`, descripcion: "Necesito ayuda con el presupuesto" };
  ok((await api(e1, "POST", "/api/encargos", { ...base, consultorId: a.id }, { origen: "https://otro.example" })).status === 403,
    "solicitar desde otro origen -> 403");

  // --- CU-22: solicitar ---------------------------------------------------------
  const creado = await api(e1, "POST", "/api/encargos", { ...base, consultorId: a.id });
  const enc = creado.json?.datos?.id;
  ok(creado.status === 201 && enc, `la empresa solicita a A (${creado.status})`);
  const repetido = await api(e1, "POST", "/api/encargos", { ...base, consultorId: a.id });
  ok(repetido.status === 409 && /solicitud abierta con este consultor/.test(repetido.json?.error ?? ""), "RN-36: otra al mismo consultor y proyecto -> 409");
  ok((await api(e1, "POST", "/api/encargos", { ...base, consultorId: b.id })).status === 409, "al equipo interno por el directorio -> 409");
  ok((await api(e1, "POST", "/api/encargos", { ...base, proyectoId: p2.id, consultorId: a.id })).status === 404, "sobre el proyecto de otra empresa -> 404");
  ok((await api(e1, "POST", "/api/encargos", { ...base, titulo: "  ", consultorId: c.id })).status === 400, "sin título -> 400");
  ok((await api(e1, "POST", "/api/encargos", { ...base, convocatoriaId: null, consultorId: c.id })).status === 400, "convocatoria específica sin convocatoria -> 400");

  const listaE1 = await api(e1, "GET", "/api/encargos");
  const vistaE1 = listaE1.json?.datos?.find((x) => x.id === enc);
  ok(vistaE1?.estado === "pendiente" && vistaE1?.consultor?.nombre === a.nombre && vistaE1?.postulacionId && vistaE1?.convocatoriaNombre,
    "la empresa lo ve pendiente, con el consultor y la postulación vinculada (CU-19 2a)");
  ok(vistaE1?.correoContraparte === null && !listaE1.texto.includes(a.correo), "RN-26: pendiente, sin el correo del consultor");
  ok(!(await api(e2, "GET", "/api/encargos")).json?.datos?.some((x) => x.id === enc), "otra empresa no lo ve");

  // --- CU-18: el consultor decide con el contexto ---------------------------------
  const listaA = await api(a, "GET", "/api/consultor/encargos");
  const vistaA = listaA.json?.datos?.find((x) => x.id === enc);
  const ctx = vistaA?.contexto;
  ok(ctx?.proyecto?.problema === `Problema del proyecto ${sufijo}` && ctx?.proyecto?.categoriasNombres?.[0] === `Sector encargos ${sufijo}`
    && ctx?.proyecto?.departamento === "08", "RF-68, RF-69: antes de aceptar ve el contenido y la clasificación del proyecto");
  ok(ctx?.convocatoria?.requisitos?.length === 2 && ctx?.checklist?.length === 2, "RF-68, RN-25: y la convocatoria con sus requisitos y el checklist vinculado");
  ok(vistaA?.empresaNombre === nombreE1 && vistaA?.correoContraparte === null && !listaA.texto.includes(e1.correo),
    "RN-26: ve el nombre de la empresa, no su correo");
  ok(!(await api(c, "GET", "/api/consultor/encargos")).json?.datos?.some((x) => x.id === enc), "otro consultor no lo ve");
  ok((await api(c, "POST", `/api/consultor/encargos/${enc}/responder`, { acepta: true })).status === 404, "otro consultor no lo responde -> 404");
  ok((await api(a, "POST", `/api/consultor/encargos/${enc}/avances`, { nota: "Nota" })).status === 409, "sin aceptar no registra avances -> 409");
  ok((await api(a, "POST", `/api/consultor/encargos/${enc}/responder`, { acepta: "sí" })).status === 400, "respuesta que no es booleana -> 400");

  const acepta = await api(a, "POST", `/api/consultor/encargos/${enc}/responder`, { acepta: true });
  ok(acepta.status === 200, `A acepta (${acepta.status})`);
  const trasAceptarE1 = (await api(e1, "GET", "/api/encargos")).json?.datos?.find((x) => x.id === enc);
  const trasAceptarA = (await api(a, "GET", "/api/consultor/encargos")).json?.datos?.find((x) => x.id === enc);
  ok(trasAceptarE1?.estado === "en_curso" && trasAceptarE1?.correoContraparte === a.correo, "RF-70: la empresa ve el correo del consultor");
  ok(trasAceptarA?.correoContraparte === e1.correo, "RF-70: y el consultor el de la empresa");
  ok((await api(e1, "GET", `/api/consultores/${a.id}`)).json?.datos?.contacto !== null, "RF-80: y el perfil del directorio ya muestra el contacto");

  ok((await api(a, "POST", `/api/consultor/encargos/${enc}/avances`, { nota: "   " })).status === 400, "nota vacía -> 400");
  const avance = await api(a, "POST", `/api/consultor/encargos/${enc}/avances`, { nota: `Encontré dos candidatas ${sufijo}` });
  ok(avance.status === 200, `A registra un avance (${avance.status})`);
  const conAvance = (await api(e1, "GET", "/api/encargos")).json?.datos?.find((x) => x.id === enc);
  ok(conAvance?.avances?.[0]?.nota === `Encontré dos candidatas ${sufijo}`, "RF-32: la empresa lee el avance");
  ok((await api(e1, "POST", `/api/encargos/${enc}/retirar`)).status === 409, "RF-89: en curso ya no se retira -> 409");
  ok((await api(e1, "POST", `/api/encargos/${enc}/calificar`, { estrellas: 5 })).status === 409, "RN-09: en curso no se califica -> 409");

  // --- Completar y calificar -------------------------------------------------------
  ok((await api(a, "POST", `/api/consultor/encargos/${enc}/completar`)).status === 200, "A lo marca como completado");
  const completado = (await api(e1, "GET", "/api/encargos")).json?.datos?.find((x) => x.id === enc);
  ok(completado?.estado === "completado" && completado?.correoContraparte === a.correo, "RN-26: completado, el correo sigue visible");
  const trasCompletarA = (await api(a, "GET", "/api/consultor/encargos")).json?.datos?.find((x) => x.id === enc);
  ok(trasCompletarA?.contexto === null && trasCompletarA?.proyectoNombre === `Proyecto encargos ${sufijo}`,
    "RN-25: completado, el consultor ya no lee el proyecto pero su historial lo nombra");
  ok((await api(e1, "POST", `/api/encargos/${enc}/calificar`, { estrellas: 0 })).status === 400, "cero estrellas -> 400");
  ok((await api(a, "POST", `/api/encargos/${enc}/calificar`, { estrellas: 5 })).status === 403, "el consultor no se califica -> 403");
  ok((await api(e1, "POST", `/api/encargos/${enc}/calificar`, { estrellas: 5, comentario: `Excelente ${sufijo}` })).status === 200, "la empresa califica con 5");
  ok((await api(e1, "POST", `/api/encargos/${enc}/calificar`, { estrellas: 1 })).status === 409, "RNF-17: la segunda calificación -> 409");
  const perfilA = (await api(e2, "GET", `/api/consultores/${a.id}`)).json?.datos;
  ok(perfilA?.ratingPromedio === 5 && perfilA?.totalEncargosCompletados === 1 && perfilA?.resenas?.[0]?.comentario === `Excelente ${sufijo}`,
    "RF-33: el rating y el contador del consultor se actualizan en el directorio");
  const calificado = (await api(e1, "GET", "/api/encargos")).json?.datos?.find((x) => x.id === enc);
  ok(calificado?.estado === "calificado" && calificado?.calificacion?.estrellas === 5, "el encargo queda calificado con su calificación");

  // --- RF-89: retirar; CU-22 4a: rechazar ---------------------------------------------
  const paraC = await api(e1, "POST", "/api/encargos", { ...base, tipoAyuda: "buscar_convocatoria", convocatoriaId: null, consultorId: c.id });
  ok(paraC.status === 201, "la empresa solicita a C para el mismo proyecto (en paralelo es válido)");
  ok((await api(e1, "POST", `/api/encargos/${paraC.json?.datos?.id}/retirar`)).status === 200, "RF-89: y la retira");
  const retiradaC = (await api(c, "GET", "/api/consultor/encargos")).json?.datos?.find((x) => x.id === paraC.json?.datos?.id);
  ok(retiradaC?.estado === "cancelado" && retiradaC?.motivoCancelacion === "Retirada por la empresa", "C la ve cancelada con el motivo");
  ok((await api(c, "POST", `/api/consultor/encargos/${paraC.json?.datos?.id}/responder`, { acepta: true })).status === 409, "retirada, C ya no la acepta -> 409");
  const otraC = await api(e1, "POST", "/api/encargos", { ...base, tipoAyuda: "buscar_convocatoria", convocatoriaId: null, consultorId: c.id });
  ok(otraC.status === 201, "retirada la anterior, puede volver a pedírsela (RN-36)");
  ok((await api(c, "POST", `/api/consultor/encargos/${otraC.json?.datos?.id}/responder`, { acepta: false })).status === 200, "C la rechaza");
  const rechazada = (await api(e1, "GET", "/api/encargos")).json?.datos?.find((x) => x.id === otraC.json?.datos?.id);
  ok(rechazada?.estado === "rechazado" && rechazada?.correoContraparte === null, "rechazada, sin correo");

  // --- CU-23, CU-26: equipo de la plataforma -----------------------------------------
  const alEquipo = await api(e1, "POST", "/api/encargos", { proyectoId: p1.id, tipoAyuda: "buscar_convocatoria", titulo: `Ayuda del equipo ${sufijo}`, descripcion: "" });
  const eq = alEquipo.json?.datos?.id;
  ok(alEquipo.status === 201, `la empresa pide ayuda al equipo (${alEquipo.status})`);
  ok((await api(e1, "POST", "/api/encargos", { proyectoId: p1.id, tipoAyuda: "buscar_convocatoria", titulo: "Otra" })).status === 409,
    "RN-36: una sola esperando por proyecto -> 409");
  const vistaEq = (await api(e1, "GET", "/api/encargos")).json?.datos?.find((x) => x.id === eq);
  ok(vistaEq?.estado === "esperando_asignacion" && vistaEq?.consultor === null && vistaEq?.via === "asignacion_interna", "la empresa la ve esperando, sin consultor");

  const bandeja = await api(adm, "GET", "/api/admin/encargos");
  const enBandeja = bandeja.json?.datos?.find((x) => x.id === eq);
  ok(enBandeja?.empresaCorreo === e1.correo && enBandeja?.empresaNombre === nombreE1 && enBandeja?.proyecto?.problema === `Problema del proyecto ${sufijo}`,
    "RF-90: la bandeja trae la empresa, su correo y el contexto del proyecto");
  const pantallaAdmin = await api(adm, "GET", "/admin/encargos");
  ok(pantallaAdmin.status === 200 && pantallaAdmin.texto.includes(`Ayuda del equipo ${sufijo}`) && pantallaAdmin.texto.includes(e1.correo),
    "la pantalla del panel muestra la solicitud y el correo");
  ok(/aria-label="\d+ esperando"/.test(pantallaAdmin.texto), "el menú del panel lleva el contador");
  ok((await api(adm, "POST", `/api/admin/encargos/${eq}/atender`, {}, { origen: "https://otro.example" })).status === 403, "atender desde otro origen -> 403");
  ok((await api(e1, "POST", `/api/admin/encargos/${eq}/atender`, {})).status === 404, "la empresa no atiende -> 404");
  const atender = await api(adm, "POST", `/api/admin/encargos/${eq}/atender`, { nota: `Le escribí el martes ${sufijo}` });
  ok(atender.status === 200, `el administrador la marca como contactada (${atender.status})`);
  ok((await api(adm, "POST", `/api/admin/encargos/${eq}/atender`, {})).status === 409, "CU-26 4a: ya atendida -> 409");
  const atendidas = (await api(adm, "GET", "/api/admin/encargos?estado=atendido")).json?.datos?.find((x) => x.id === eq);
  ok(atendidas?.notaInterna === `Le escribí el martes ${sufijo}` && atendidas?.atendidoPorNombre === "Admin encargos", "queda en atendidas con la nota y quién");
  const listaTrasAtender = await api(e1, "GET", "/api/encargos");
  ok(listaTrasAtender.json?.datos?.find((x) => x.id === eq)?.estado === "atendido" && !listaTrasAtender.texto.includes("Le escribí el martes"),
    "la empresa la ve atendida y no lee la nota interna");
  ok((await api(e1, "POST", `/api/encargos/${eq}/retirar`)).status === 409, "atendida ya no se retira -> 409");
  ok((await api(adm, "GET", "/api/admin/encargos?estado=otro")).status === 400, "estado inválido en el panel -> 400");

  // --- Pantallas ---------------------------------------------------------------------
  const pantallaE1 = await api(e1, "GET", "/encargos");
  ok(pantallaE1.status === 200 && pantallaE1.texto.includes(`Estructurar la postulación ${sufijo}`) && pantallaE1.texto.includes(a.correo),
    "la pantalla de la empresa muestra sus encargos y el correo aceptado");
  const pantallaE2 = await api(e2, "GET", "/encargos");
  ok(pantallaE2.status === 200 && !pantallaE2.texto.includes(`Estructurar la postulación ${sufijo}`) && !pantallaE2.texto.includes(a.correo)
    && !pantallaE2.texto.includes(`Ayuda del equipo ${sufijo}`), "la de otra empresa no muestra los encargos ajenos (Hito 1)");
  const pantallaA = await api(a, "GET", "/consultor/encargos");
  ok(pantallaA.status === 200 && pantallaA.texto.includes(`Estructurar la postulación ${sufijo}`), "la pantalla del consultor muestra su historial");
  ok((await api(e1, "GET", "/consultor/encargos")).status !== 200, "la empresa no entra a la bandeja del consultor");
} catch (e) {
  fallas++;
  console.error("FALLA inesperada:", e);
} finally {
  if (cuentas.length) {
    await svc.from("calificaciones").delete().in("empresa_id", cuentas);
    await svc.from("encargos").delete().in("empresa_id", cuentas);
    await svc.from("postulaciones").delete().in("usuario_id", cuentas);
    await svc.from("proyectos").delete().in("usuario_id", cuentas);
  }
  if (convocatorias.length) {
    await svc.from("requisitos_convocatoria").delete().in("convocatoria_id", convocatorias);
    await svc.from("convocatorias").delete().in("id", convocatorias);
  }
  for (const id of [...cuentas].reverse()) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (categorias.length) await svc.from("categorias").delete().in("id", categorias);
  if (invitaciones.length) await svc.from("invitaciones_admin").delete().in("id", invitaciones);
  console.log(fallas === 0 ? "\nTODO PASA" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
