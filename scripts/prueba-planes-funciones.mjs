// Prueba de las funciones por plan contra Supabase real y la aplicación
// (RN-11, RN-16, RN-41, RF-36, RF-40, RF-120 · docs/05 §9.38 · sesión 042).
//
//   IA_PROVEEDOR=prueba npm run dev               (o la configuración "dev-ia-prueba")
//   node --env-file=.env.local scripts/prueba-planes-funciones.mjs
//
// Tres empresas temporales —una en Gratis (como nace), una en Esencial y una en
// Pro, con los planes reales— intentan cada función por la API; las pantallas
// bloqueadas se leen en el HTML. Al final la de Pro vence y baja a Gratis: lee y
// descarga lo suyo, pero no lo avanza. Con el proveedor de IA de prueba no se
// gasta saldo. Crea sus cuentas y su convocatoria y lo borra todo al terminar.
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
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const masDias = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [];
let convocatoriaId = null;
const EXPLICACION = "Somos una empresa de Boyacá que quiere instalar paneles solares en veinte fincas lecheras para bajar el costo de la energía y enfriar la leche. Buscamos cien millones de pesos y lo haríamos en doce meses.";

try {
  const { data: planes } = await svc.from("planes").select("id, nombre, es_gratuito").eq("rol", "empresa");
  const esencial = planes.find((p) => p.nombre === "Empresa Esencial");
  const pro = planes.find((p) => p.nombre === "Empresa Pro");
  const gratis = planes.find((p) => p.es_gratuito);
  ok(esencial && pro && gratis, "existen Gratis, Esencial y Pro");

  const clave = crypto.randomBytes(18).toString("base64url");
  const crear = async (rol, nombre, plan) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.funciones.${sufijo}@example.com`, password: clave, email_confirm: true,
      user_metadata: { rol, nombre, nombre_empresa: rol === "empresa" ? `Empresa ${nombre} ${sufijo}` : undefined, consentimiento_datos: true },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    if (plan) {
      const { error: e } = await svc.from("suscripciones")
        .update({ plan_id: plan.id, modalidad: "mensual", estado: "activa", fecha_vencimiento: masDias(hoy, 30) })
        .eq("usuario_id", data.user.id);
      if (e) throw e;
    }
    const s = sesion();
    const { error: eS } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (eS) throw eS;
    s.id = data.user.id;
    return s;
  };
  const g = await crear("empresa", "gratis");
  const e = await crear("empresa", "esencial", esencial);
  const p = await crear("empresa", "pro", pro);
  const c = await crear("consultor", "consultora");
  await svc.from("consultor_perfiles").update({
    nombre_profesional: `Consultora ${sufijo}`, descripcion: "Formulo proyectos", foto_path: `${c.id}/f.png`, cv_path: `${c.id}/cv.pdf`, estado_perfil: "aprobado",
  }).eq("id", c.id);

  const { data: susG } = await svc.from("suscripciones").select("estado, modalidad, fecha_vencimiento, plan_id").eq("usuario_id", g.id).single();
  ok(susG.estado === "gratis" && susG.modalidad === "gratis" && susG.fecha_vencimiento === null && susG.plan_id === gratis.id,
    "RN-11: el registro deja a la empresa en Gratis, sin vencimiento");

  const { data: conv, error: eC } = await svc.from("convocatorias").insert({
    todos_los_paises: true, nombre: `Convocatoria funciones ${sufijo}`, entidad_convocante: "Entidad de prueba", descripcion: "Energía rural",
    cobertura_nacional: true, fecha_cierre: masDias(hoy, 20), estado: "publicada", url_postulacion: "https://prueba.gov.co/funciones",
  }).select("id").single();
  if (eC) throw eC;
  convocatoriaId = conv.id;
  await svc.from("requisitos_convocatoria").insert([
    { convocatoria_id: conv.id, descripcion: "RUT", tipo: "documento", obligatorio: true, orden: 1 },
    { convocatoria_id: conv.id, descripcion: "Carta", tipo: "documento", obligatorio: true, orden: 2 },
  ]);
  const proyecto = async (s, n) => (await svc.from("proyectos").insert({ usuario_id: s.id, nombre: `Proyecto ${n} ${sufijo}`, problema: "Energía cara" }).select("id").single()).data.id;
  const pg = await proyecto(g, "G"), pe = await proyecto(e, "E"), pp = await proyecto(p, "P"), pp2 = await proyecto(p, "P2");

  // --- La API por plan (RN-41) -------------------------------------------------------------
  // 200 o 201 es éxito; 402 es «su plan no la incluye».
  const estados = async (s, pr) => [
    (await api(s, "GET", `/api/proyectos/${pr}/sugerencias`)).status,
    (await api(s, "POST", "/api/postulaciones", { convocatoriaId: conv.id, proyectoId: pr })).status,
    (await api(s, "POST", "/api/proyectos/estructurar", { explicacion: EXPLICACION })).status,
    (await api(s, "POST", "/api/documentos/generar", { proyectoId: pr, convocatoriaId: conv.id })).status,
    (await api(s, "GET", "/api/consultores")).status,
    (await api(s, "POST", "/api/encargos", { proyectoId: pr, consultorId: c.id, tipoAyuda: "buscar_convocatoria", titulo: "Ayuda", descripcion: "Buscar convocatoria" })).status,
  ].map((x) => (x === 200 || x === 201 ? "ok" : x)).join(" ");
  const rg = await estados(g, pg), re = await estados(e, pe), rp = await estados(p, pp);
  ok(rg === "402 402 402 402 402 402", `Gratis · sugerencias, postular, proyecto con IA, documento, directorio, encargo -> ${rg}`);
  ok(re === "ok ok ok ok 402 402", `Esencial · lo mismo -> ${re}`);
  ok(rp === "ok ok ok ok ok ok", `Pro · lo mismo -> ${rp}`);
  const mensaje = (await api(g, "POST", "/api/postulaciones", { convocatoriaId: conv.id, proyectoId: pg })).json?.error ?? "";
  ok(/plan Esencial/.test(mensaje), `RF-120: el rechazo dice en qué plan está ("${mensaje}")`);
  const perfil = await api(g, "GET", `/api/consultores/${c.id}`);
  ok(perfil.status === 402, `RN-41: Gratis no abre el perfil de un consultor del directorio (${perfil.status})`);

  // --- Las pantallas: bloqueadas pero visibles (RF-120) ---------------------------------------
  const html = async (s, ruta) => (await api(s, "GET", ruta)).texto;
  const dirG = await html(g, "/consultores");
  ok(/data-funcion-bloqueada="consultores"/.test(dirG) && /Disponible en el plan/.test(dirG) && !dirG.includes(`Consultora ${sufijo}`),
    "RF-120: Gratis ve el directorio bloqueado, sin la lista de consultores");
  const dirP = await html(p, "/consultores");
  ok(!/data-funcion-bloqueada/.test(dirP) && dirP.includes(`Consultora ${sufijo}`), "RF-120: Pro ve el directorio con la consultora");
  const postG = await html(g, "/postulaciones");
  ok(/data-funcion-bloqueada="postulaciones"/.test(postG) && /Mejorar plan/.test(postG), "RF-120: Gratis ve Postulaciones bloqueada con «Mejorar plan»");
  const encE = await html(e, "/encargos");
  ok(/data-funcion-bloqueada="consultores"/.test(encE), "RF-120: Esencial ve Mis encargos bloqueado (es de Pro)");
  const susG2 = await html(g, `/suscripcion?plan=${esencial.id}`);
  ok(susG2.includes(`id="plan-${esencial.id}"`) && /Incluye lo que buscaba/.test(susG2) && /Gratis/.test(susG2),
    "RF-120: «Mejorar plan» señala el plan en la comparación, con Gratis incluido");

  // --- Pro vence y baja a Gratis (RN-16) ----------------------------------------------------
  const { data: postP } = await svc.from("postulaciones").select("id, postulacion_checklist (id)").eq("usuario_id", p.id).single();
  const { data: docP } = await svc.from("documentos_generados").select("id").eq("usuario_id", p.id).limit(1).single();
  const { data: encP } = await svc.from("encargos").select("id").eq("empresa_id", p.id).limit(1).single();
  await svc.from("suscripciones").update({ fecha_inicio: masDias(hoy, -40), fecha_vencimiento: masDias(hoy, -10) }).eq("usuario_id", p.id);

  const leer = (await api(p, "GET", `/api/postulaciones/${postP.id}`)).status;
  const marcar = await api(p, "PATCH", `/api/checklist/${postP.postulacion_checklist[0].id}`, { completado: true });
  const avanzar = (await api(p, "POST", `/api/postulaciones/${postP.id}/estado`, { estado: "presentada" })).status;
  const exportar = (await api(p, "GET", `/api/documentos/${docP.id}/exportar`)).status;
  const generar = (await api(p, "POST", "/api/documentos/generar", { proyectoId: pp2, convocatoriaId: conv.id })).status;
  const otroEncargo = (await api(p, "POST", "/api/encargos", { proyectoId: pp2, consultorId: c.id, tipoAyuda: "buscar_convocatoria", titulo: "Otra", descripcion: "Otra" })).status;
  const retirar = (await api(p, "POST", `/api/encargos/${encP.id}/retirar`)).status;
  ok(leer === 200 && exportar === 200, `RN-16: vencido, lee su postulación (${leer}) y descarga su documento (${exportar})`);
  ok(marcar.status === 402 && avanzar === 402 && /solo lectura|no crear nuevas/.test(marcar.json?.error ?? ""),
    `RN-41: no marca el checklist (${marcar.status}) ni avanza la postulación (${avanzar})`);
  ok(generar === 402 && otroEncargo === 402, `RN-41: no genera (${generar}) ni solicita consultores (${otroEncargo})`);
  ok(retirar === 200, `RN-41: sí retira una solicitud de encargo (${retirar})`);
  const postP2 = await html(p, "/postulaciones");
  ok(/solo lectura/.test(postP2) && postP2.includes("Convocatoria funciones"), "RF-120: ve sus postulaciones en solo lectura");
  const encP2 = await html(p, "/encargos");
  ok(/solo lectura/.test(encP2) && /Ayuda/.test(encP2), "RF-120: ve sus encargos en solo lectura");
  const { count } = await svc.from("documentos_generados").select("id", { count: "exact", head: true }).eq("usuario_id", p.id);
  ok(count >= 1, `RN-16: no se borró nada (${count} documento)`);
} catch (err) {
  fallas++;
  console.error("FALLA inesperada:", err);
} finally {
  for (const id of cuentas) {
    await svc.from("encargos").delete().eq("empresa_id", id);
    await svc.from("documentos_generados").delete().eq("usuario_id", id);
    await svc.from("postulaciones").delete().eq("usuario_id", id);
    await svc.from("proyectos").delete().eq("usuario_id", id);
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (convocatoriaId) {
    await svc.from("requisitos_convocatoria").delete().eq("convocatoria_id", convocatoriaId);
    const { error } = await svc.from("convocatorias").delete().eq("id", convocatoriaId);
    if (error) console.log(`No se pudo borrar la convocatoria ${convocatoriaId}: ${error.message}`);
  }
  console.log(fallas === 0 ? "\nTODO PASA" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
