// Prueba de planes, suscripciones y paquetes contra Supabase real
// (CU-28..31 · RF-36, RF-38, RF-40, RF-41, RF-42, RF-51, RF-82, RF-85, RN-28,
//  RN-29, RNF-20, RNF-28, RNF-30 · docs/05 §9.28 · Sprint 5 · sesión 028).
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-planes-suscripciones.mjs
//
// No llama a la IA. Crea un administrador por invitación con TOTP, dos
// empresas y un consultor aprobado temporales. La base es la de producción: el
// plan que crea la prueba nace inactivo (nunca aparece en el comparador) y se
// borra al final con todas las cuentas, sus suscripciones y sus pagos.
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
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const masDias = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], invitaciones = [], planesCreados = [], convocatorias = [];
let adminId = null;

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre, extra = {}) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.planes.${sufijo}@example.com`, password: clave, email_confirm: true,
      user_metadata: { rol, nombre, consentimiento_datos: true, ...extra },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    const s = sesion();
    const { error: e } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (e) throw e;
    return { s, id: data.user.id };
  };
  const uno = await crearCuenta("empresa", "uno", { nombre_empresa: `Empresa Uno ${sufijo}` });
  const dos = await crearCuenta("empresa", "dos", { nombre_empresa: `Empresa Dos ${sufijo}` });
  const cons = await crearCuenta("consultor", "consultor");
  await svc.from("consultor_perfiles").update({
    nombre_profesional: `Consultora ${sufijo}`, descripcion: "Formulo proyectos", foto_path: `${cons.id}/f.png`, cv_path: `${cons.id}/cv.pdf`, estado_perfil: "aprobado",
  }).eq("id", cons.id);

  const { data: planes } = await svc.from("planes").select("id, nombre, rol, es_trial, precio_mensual, precio_anual, creditos_ia_mensuales");
  const esencial = planes.find((p) => p.nombre === "Empresa Esencial");
  const pro = planes.find((p) => p.nombre === "Empresa Pro");
  const planConsultor = planes.find((p) => p.rol === "consultor" && p.nombre === "Consultor");
  const trial = planes.find((p) => p.es_trial);
  ok(esencial && pro && planConsultor && trial, "§9.28: existen los planes semilla y el trial");

  // Administrador por invitación (CU-41), primero sin MFA.
  const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
  const correoAdmin = `admin.planes.${sufijo}@example.com`;
  const { data: invId } = await svc.rpc("crear_invitacion_admin", { p_propietario: propietario.id, p_correo: correoAdmin, p_nombre: "Admin planes" });
  invitaciones.push(invId);
  const { data: uAdmin } = await svc.auth.admin.createUser({ email: correoAdmin, password: clave, email_confirm: true });
  adminId = uAdmin.user.id;
  await svc.rpc("aceptar_invitacion_admin", { p_invitacion: invId, p_usuario: adminId });
  const adm = sesion();
  await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: clave });

  // --- Quien no es administrador con MFA: 404 (RF-85, RNF-28) -----------------------------
  const rutas = [
    ["GET", "/api/admin/planes"], ["POST", "/api/admin/planes", { nombre: "X", rol: "empresa", precioMensual: "1", precioAnual: "1", creditosIaMensuales: 1 }],
    ["PATCH", `/api/admin/planes/${esencial.id}`, { nombre: "X", rol: "empresa", precioMensual: "1", precioAnual: "1", creditosIaMensuales: 1 }],
    ["GET", "/api/admin/suscripciones"], ["POST", "/api/admin/suscripciones/activar", { usuarioId: uno.id, planId: pro.id, modalidad: "mensual", monto: "1", fechaPago: hoy }],
    ["POST", `/api/admin/suscripciones/${crypto.randomUUID()}/creditos`, { cantidad: 100 }], ["POST", `/api/admin/suscripciones/${crypto.randomUUID()}/suspender`, {}],
  ];
  ok((await api(null, "GET", "/api/admin/suscripciones")).status === 404, "RF-85: anónimo -> 404");
  for (const [nombre, s] of [["empresa", uno.s], ["consultor", cons.s]]) {
    const r = await Promise.all(rutas.map(([m, ruta, c]) => api(s, m, ruta, c)));
    ok(r.every((x) => x.status === 404), `RF-85/RNF-28: ${nombre} -> 404 en las 7 rutas (${r.map((x) => x.status).join("/")})`);
  }
  const sinMfa = await Promise.all([api(adm, "GET", "/api/admin/suscripciones"), api(adm, "POST", "/api/admin/suscripciones/activar", rutas[4][2]), api(adm, "GET", "/admin/planes")]);
  ok(sinMfa.every((r) => r.status === 307 && /\/mfa/.test(r.destino ?? "")), `RNF-28: administrador sin MFA -> /mfa (${sinMfa.map((r) => r.status).join("/")})`);
  const { data: susUno0 } = await svc.from("suscripciones").select("estado, plan_id").eq("usuario_id", uno.id).single();
  ok(susUno0.estado === "trial" && susUno0.plan_id === trial.id, "RNF-28: y la empresa sigue en su trial");

  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  ok(!eMfa, `administrador verifica su TOTP (aal2) ${eMfa?.message ?? ""}`);

  // --- RF-36: planes ---------------------------------------------------------------------------
  const lista = await api(adm, "GET", "/api/admin/planes");
  ok(lista.status === 200 && lista.json.datos.some((p) => p.esTrial) && lista.json.datos.some((p) => p.id === pro.id), `RF-36: lista los planes con el trial (${lista.json?.datos?.length})`);
  const nombrePlan = `Plan prueba ${sufijo}`;
  const crear = await api(adm, "POST", "/api/admin/planes", { nombre: nombrePlan, rol: "empresa", precioMensual: "120.000", precioAnual: "1200000", creditosIaMensuales: "20", activo: false });
  const idPlan = crear.json?.datos?.id;
  if (idPlan) planesCreados.push(idPlan);
  const { data: filaPlan } = await svc.from("planes").select("*").eq("id", idPlan).maybeSingle();
  ok(crear.status === 200 && filaPlan?.precio_mensual == 120000 && filaPlan.creditos_ia_mensuales === 20 && !filaPlan.activo,
    `RF-36: crea un plan con "120.000" como 120000 pesos, inactivo (${crear.status})`);
  const editar = await api(adm, "PATCH", `/api/admin/planes/${idPlan}`, { nombre: nombrePlan, rol: "empresa", precioMensual: "125000", precioAnual: "1.250.000", creditosIaMensuales: 25, activo: false });
  const { data: filaPlan2 } = await svc.from("planes").select("*").eq("id", idPlan).maybeSingle();
  ok(editar.status === 200 && filaPlan2.precio_anual == 1250000 && filaPlan2.creditos_ia_mensuales === 25, `RF-36: lo edita (${editar.status})`);
  const invalidosPlan = [
    [{ nombre: "", rol: "empresa", precioMensual: "1", precioAnual: "1", creditosIaMensuales: 1 }, 400, "sin nombre"],
    [{ nombre: "Y", rol: "admin", precioMensual: "1", precioAnual: "1", creditosIaMensuales: 1 }, 400, "rol inválido"],
    [{ nombre: "Y", rol: "empresa", precioMensual: "1.000000", precioAnual: "1", creditosIaMensuales: 1 }, 400, "precio mal escrito"],
    [{ nombre: "Y", rol: "empresa", precioMensual: "1", precioAnual: "1", creditosIaMensuales: 1001 }, 400, "créditos sobre el tope"],
    [{ nombre: "Y", rol: "consultor", precioMensual: "1", precioAnual: "1", creditosIaMensuales: 5 }, 400, "consultor con créditos (RN-28)"],
    [{ nombre: "empresa pro", rol: "empresa", precioMensual: "1", precioAnual: "1", creditosIaMensuales: 1 }, 409, "nombre repetido"],
  ];
  for (const [cuerpo, esperado, caso] of invalidosPlan) {
    const r = await api(adm, "POST", "/api/admin/planes", cuerpo);
    ok(r.status === esperado, `RNF-20: plan con ${caso} -> ${esperado} (${r.status})`);
  }
  const trialPago = await api(adm, "PATCH", `/api/admin/planes/${trial.id}`, { nombre: "Trial", rol: "empresa", precioMensual: "1000", precioAnual: "0", creditosIaMensuales: 3, activo: true, diasTrial: 7 });
  ok(trialPago.status === 409, `§9.28: el trial no se cobra (${trialPago.status})`);
  ok((await api(adm, "POST", "/api/admin/planes", invalidosPlan[0][0], { origen: "https://otro.example" })).status === 403, "RNF-30: crear desde otro origen -> 403");
  ok((await api(adm, "PATCH", "/api/admin/planes/no-es-uuid", invalidosPlan[0][0])).status === 404, "RNF-30: id que no es uuid -> 404");

  // --- RF-38: activar -------------------------------------------------------------------------
  const cuentasAntes = await api(adm, "GET", "/api/admin/suscripciones");
  const filaUno = cuentasAntes.json?.datos?.cuentas?.find((c) => c.usuarioId === uno.id);
  const filaCons = cuentasAntes.json?.datos?.cuentas?.find((c) => c.usuarioId === cons.id);
  ok(cuentasAntes.status === 200 && filaUno?.estado === "trial" && filaUno.correo === `uno.planes.${sufijo}@example.com` && filaCons && filaCons.estado === null,
    "RF-42: las cuentas traen la empresa en trial y la consultora aprobada sin suscripción");
  ok(typeof cuentasAntes.json?.datos?.tablero?.costoUsd === "number" && cuentasAntes.json.datos.tablero.trial >= 2, "RF-42: el tablero trae estados y consumo del mes");

  const malos = [
    [{ usuarioId: uno.id, planId: planConsultor.id, modalidad: "mensual", monto: "69.000", fechaPago: hoy }, 409, "plan de consultor a una empresa"],
    [{ usuarioId: uno.id, planId: idPlan, modalidad: "mensual", monto: "1", fechaPago: hoy }, 409, "plan inactivo"],
    [{ usuarioId: uno.id, planId: pro.id, modalidad: "trial", monto: "1", fechaPago: hoy }, 400, "modalidad trial"],
    [{ usuarioId: uno.id, planId: pro.id, modalidad: "mensual", monto: "0", fechaPago: hoy }, 400, "monto 0"],
    [{ usuarioId: uno.id, planId: pro.id, modalidad: "mensual", monto: "1", fechaPago: masDias(hoy, 1) }, 400, "fecha futura"],
    [{ usuarioId: adminId, planId: pro.id, modalidad: "mensual", monto: "1", fechaPago: hoy }, 404, "cuenta de administrador"],
  ];
  for (const [cuerpo, esperado, caso] of malos) {
    const r = await api(adm, "POST", "/api/admin/suscripciones/activar", cuerpo);
    ok(r.status === esperado, `RF-38: activar con ${caso} -> ${esperado} (${r.status})`);
  }

  const activar = await api(adm, "POST", "/api/admin/suscripciones/activar", { usuarioId: uno.id, planId: esencial.id, modalidad: "mensual", monto: "89.000", fechaPago: hoy });
  const { data: susUno } = await svc.from("suscripciones").select("*").eq("usuario_id", uno.id);
  ok(activar.status === 200 && susUno.length === 1 && susUno[0].estado === "activa" && susUno[0].plan_id === esencial.id && susUno[0].fecha_inicio === hoy && susUno[0].activada_por === adminId,
    `RF-38: la empresa pasa del trial a Esencial activa, en la misma fila (${activar.status}, vence ${susUno[0]?.fecha_vencimiento})`);
  const activarCons = await api(adm, "POST", "/api/admin/suscripciones/activar", { usuarioId: cons.id, planId: planConsultor.id, modalidad: "anual", monto: "690.000", fechaPago: hoy });
  ok(activarCons.status === 200, `CU-28: la consultora aprobada se suscribe al plan anual (${activarCons.status})`);

  // --- RF-51: paquetes ----------------------------------------------------------------------
  const paquete = await api(adm, "POST", `/api/admin/suscripciones/${susUno[0].id}/creditos`, { cantidad: "10", monto: "39.000" });
  const { data: susUno2 } = await svc.from("suscripciones").select("creditos_extra").eq("id", susUno[0].id).single();
  ok(paquete.status === 200 && susUno2.creditos_extra === 10, `RF-51: paquete de 10 créditos (${paquete.status}, extra ${susUno2.creditos_extra})`);
  const susCons = (await svc.from("suscripciones").select("id").eq("usuario_id", cons.id).single()).data;
  ok((await api(adm, "POST", `/api/admin/suscripciones/${susCons.id}/creditos`, { cantidad: 5 })).status === 409, "RN-28: al consultor no se le otorgan créditos -> 409");
  ok((await api(adm, "POST", `/api/admin/suscripciones/${susUno[0].id}/creditos`, { cantidad: 101 })).status === 400, "RF-51: más de 100 -> 400");

  // --- Vista del suscriptor (RF-41, RF-82, CU-30) --------------------------------------------
  const vista = await api(uno.s, "GET", "/suscripcion");
  ok(vista.status === 200 && vista.texto.includes("Empresa Esencial") && vista.texto.includes("Paquete de 10 créditos de IA") && /89\.000/.test(vista.texto),
    "CU-30: la empresa ve su plan y el historial de pagos con el paquete");
  ok(!vista.texto.includes(nombrePlan), "RF-82: un plan inactivo no aparece en el comparador");
  const { data: pagosDos } = await dos.s.cliente.from("pagos_suscripcion").select("id");
  ok(pagosDos?.length === 0, "RN-30: otra empresa no lee esos pagos");
  const vistaCons = await api(cons.s, "GET", "/consultor/suscripcion");
  ok(vistaCons.status === 200, `CU-30: la consultora abre su suscripción (${vistaCons.status})`);

  // --- CU-31 paso 4: suspender a la segunda empresa -------------------------------------------
  const susDos = (await svc.from("suscripciones").select("id").eq("usuario_id", dos.id).single()).data;
  const suspender = await api(adm, "POST", `/api/admin/suscripciones/${susDos.id}/suspender`, {});
  const { data: susDos2 } = await svc.from("suscripciones").select("estado").eq("id", susDos.id).single();
  ok(suspender.status === 200 && susDos2.estado === "suspendida", `CU-31: suspende (${suspender.status})`);
  ok((await api(adm, "POST", `/api/admin/suscripciones/${susDos.id}/suspender`, {})).status === 409, "CU-31: no se suspende dos veces -> 409");
  // Con un proyecto propio y una convocatoria vigente, para que la única razón del rechazo sea la suscripción.
  const { data: proyectoDos } = await svc.from("proyectos").insert({ usuario_id: dos.id, nombre: `Proyecto ${sufijo}` }).select("id").single();
  const { data: vigente, error: eConv } = await svc.from("convocatorias").insert({
    nombre: `Convocatoria planes ${sufijo}`, entidad_convocante: "Entidad de prueba", cobertura_nacional: true,
    fecha_cierre: masDias(hoy, 20), estado: "publicada", url_postulacion: "https://prueba.gov.co/planes",
  }).select("id").single();
  if (eConv) throw eConv;
  convocatorias.push(vigente.id);
  const generar = await api(dos.s, "POST", "/api/documentos/generar", { proyectoId: proyectoDos.id, convocatoriaId: vigente.id });
  ok(generar.status === 402, `RF-40: la empresa suspendida no genera con IA -> 402 (${generar.status})`);

  // --- Pantallas del panel ---------------------------------------------------------------------
  const pPlanes = await api(adm, "GET", "/admin/planes");
  const pSus = await api(adm, "GET", "/admin/suscripciones");
  ok(pPlanes.status === 200 && pPlanes.texto.includes("Empresa Pro") && pSus.status === 200 && pSus.texto.includes(`Empresa Uno ${sufijo}`),
    "CU-31: las pantallas del panel muestran planes y cuentas reales");
} catch (e) {
  console.error("ERROR", e);
  fallas++;
} finally {
  // Las cuentas arrastran sus suscripciones y pagos; después el plan y al final el administrador.
  for (const id of [...cuentas].reverse()) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (convocatorias.length) await svc.from("convocatorias").delete().in("id", convocatorias);
  if (planesCreados.length) {
    const { error } = await svc.from("planes").delete().in("id", planesCreados);
    if (error) console.log("No se pudo borrar el plan de prueba:", error.message);
  }
  if (adminId) {
    const { error } = await svc.auth.admin.deleteUser(adminId);
    if (error) console.log(`No se pudo borrar el administrador: ${error.message}`);
  }
  if (invitaciones.length) await svc.from("invitaciones_admin").delete().in("id", invitaciones);
  const { count } = await svc.from("planes").select("id", { count: "exact", head: true }).ilike("nombre", `%${sufijo}%`);
  ok(count === 0, "limpieza: no queda el plan de prueba");
  console.log(fallas === 0 ? "\nTODO PASA" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
