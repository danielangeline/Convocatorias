// Prueba del vencimiento de suscripciones contra Supabase real (RF-39, RF-40,
// RN-16, CU-32 · docs/05 §9.7 · Sprint 4 paso 4).
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-vencimiento-suscripciones.mjs
//
// Crea una empresa temporal y mueve su suscripción por cada momento del ciclo
// con service_role: la franja del portal (RN-16) y lo que el servidor deja
// hacer (RF-40) deben decir lo mismo. Borra todo al terminar.
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
async function api(s, metodo, ruta, cuerpo) {
  const headers = { "content-type": "application/json", origin: APP, cookie: s.cookie() };
  const r = await fetch(APP + ruta, { method: metodo, headers, redirect: "manual", body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* HTML */ }
  return { status: r.status, json, texto };
}
// La fecha de Colombia, como privado.hoy_colombia().
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const dia = (n) => new Date(Date.parse(hoy + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

const sufijo = crypto.randomBytes(3).toString("hex");
let cuenta = null;

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const { data, error } = await svc.auth.admin.createUser({
    email: `empresa.vencimiento.${sufijo}@example.com`, password: clave, email_confirm: true,
    user_metadata: { rol: "empresa", nombre: "Empresa", nombre_empresa: `Vencimiento ${sufijo}`, consentimiento_datos: true },
  });
  if (error) throw error;
  cuenta = data.user.id;
  const e = sesion();
  await e.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });

  const { data: sus } = await svc.from("suscripciones").select("id, fecha_inicio, fecha_vencimiento, estado").eq("usuario_id", cuenta).single();
  ok(sus.fecha_inicio === hoy && sus.fecha_vencimiento === dia(7) && sus.estado === "trial", `el trial empieza hoy en Colombia (${sus.fecha_inicio} a ${sus.fecha_vencimiento})`);
  const { data: proyecto } = await svc.from("proyectos").insert({ usuario_id: cuenta, nombre: `Proyecto vencimiento ${sufijo}` }).select("id").single();

  const fijar = (estado, vence) => svc.from("suscripciones").update({ estado, fecha_inicio: dia(-30), fecha_vencimiento: vence }).eq("id", sus.id);
  const franja = async () => {
    const r = await api(e, "GET", "/proyectos");
    const m = r.texto.match(/role="status"[^>]*>.*?<p class="flex-1">([^<]*)</s);
    return m ? m[1].replace(/&#x27;/g, "'") : null;
  };
  const sugerencias = async () => (await api(e, "GET", `/api/proyectos/${proyecto.id}/sugerencias`)).status;

  ok((await franja()) === null, "con 7 días por delante no hay franja");

  await fijar("trial", dia(1));
  let f = await franja();
  ok(/vence mañana/.test(f ?? "") && /5 días de gracia/.test(f ?? ""), `a un día: "${f}"`);

  await fijar("trial", hoy);
  f = await franja();
  ok(/vence hoy/.test(f ?? "") && (await sugerencias()) === 200, `el día del vencimiento todavía tiene acceso: "${f}"`);

  // El job todavía no corrió: estado trial con la fecha ya pasada.
  await fijar("trial", dia(-2));
  f = await franja();
  ok(/periodo de gracia: te quedan 3 días/.test(f ?? "") && (await sugerencias()) === 200, `en gracia aunque el job no haya corrido: "${f}"`);

  await fijar("en_gracia", dia(-5));
  f = await franja();
  ok(/hoy es el último día/.test(f ?? "") && (await sugerencias()) === 200, `último día de gracia: "${f}"`);

  await fijar("en_gracia", dia(-6));
  f = await franja();
  const bloqueo = await sugerencias();
  ok(/terminó el periodo de gracia/.test(f ?? "") && bloqueo === 402, `pasada la gracia, la franja y el servidor coinciden (402: ${bloqueo}): "${f}"`);
  const solicitar = await api(e, "POST", "/api/encargos", { proyectoId: proyecto.id, tipoAyuda: "buscar_convocatoria", titulo: "Ayuda" });
  ok(solicitar.status === 402, `sin suscripción no solicita consultor (${solicitar.status})`);
  ok((await api(e, "GET", "/convocatorias")).status === 200, "el catálogo sigue disponible (CU-32 paso 2)");

  await fijar("vencida", dia(-20));
  f = await franja();
  ok(/terminó el periodo de gracia/.test(f ?? "") && /el catálogo sigue disponible/.test(f ?? ""), `vencida: "${f}"`);
} catch (err) {
  fallas++;
  console.error("FALLA inesperada:", err);
} finally {
  if (cuenta) {
    await svc.from("encargos").delete().eq("empresa_id", cuenta);
    await svc.from("proyectos").delete().eq("usuario_id", cuenta);
    const { error } = await svc.auth.admin.deleteUser(cuenta);
    if (error) console.log(`No se pudo borrar la cuenta ${cuenta}: ${error.message}`);
  }
  console.log(fallas === 0 ? "\nTODO PASA" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
