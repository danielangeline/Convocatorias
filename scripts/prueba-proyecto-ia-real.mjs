// Estructurar un proyecto y transcribir un audio con el proveedor REAL (OpenAI),
// para comprobar que acepta el esquema y que la propuesta no inventa (CU-43 ·
// RF-96, RF-97, RN-37, RNF-23 · sesión 030). Gasta saldo: fracciones de centavo.
//
//   npm run dev                                   (sin IA_PROVEEDOR=prueba)
//   node --env-file=.env.local scripts/prueba-proyecto-ia-real.mjs
//
// La explicación omite a propósito el departamento, la duración, el presupuesto
// y la experiencia: la propuesta debe dejarlos vacíos y listarlos en faltantes.
// Crea una empresa temporal y la borra al terminar.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import crypto from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.PRUEBA_URL ?? "http://localhost:3000";
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fallas = 0;
const ok = (c, d) => { console.log(c ? "ok   " : "FALLA", d); if (!c) fallas++; };

const EXPLICACION =
  "Somos una cooperativa de caficultores. Queremos instalar secadores solares de café para que el grano no se dañe con la lluvia " +
  "y podamos venderlo como café especial a mejor precio. Beneficiaría a 120 familias productoras pequeñas. " +
  "Necesitamos conseguir 150 millones de pesos para comprar los secadores y capacitar a los productores en su uso.";

// Un segundo de tono en WAV: basta para que el proveedor acepte el modelo y el formato.
function wav() {
  const muestras = 16000, datos = Buffer.alloc(muestras * 2);
  for (let i = 0; i < muestras; i++) datos.writeInt16LE(Math.round(Math.sin((i / 16000) * 2 * Math.PI * 440) * 8000), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + datos.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(16000, 24);
  h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(datos.length, 40);
  return Buffer.concat([h, datos]);
}

let id = null;
try {
  const jar = new Map();
  const cliente = createServerClient(URL_, ANON, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (c) => c.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) },
  });
  const cookie = () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
  const sufijo = crypto.randomBytes(3).toString("hex"), clave = crypto.randomBytes(18).toString("base64url");
  const { data, error } = await svc.auth.admin.createUser({
    email: `real.pia.${sufijo}@example.com`, password: clave, email_confirm: true,
    user_metadata: { rol: "empresa", nombre: "Ana", nombre_empresa: `Cooperativa ${sufijo}`, consentimiento_datos: true },
  });
  if (error) throw error;
  id = data.user.id;
  await cliente.auth.signInWithPassword({ email: data.user.email, password: clave });

  const t0 = Date.now();
  const r = await fetch(`${APP}/api/proyectos/estructurar`, {
    method: "POST", headers: { "content-type": "application/json", cookie: cookie(), origin: APP }, body: JSON.stringify({ explicacion: EXPLICACION }),
  });
  const json = await r.json();
  console.log(JSON.stringify(json, null, 2));
  const p = json.datos;
  ok(r.status === 200, `RF-96: el proveedor real acepta el esquema y responde (${r.status}, ${Date.now() - t0} ms)`);
  ok(p?.montoBuscado === 150_000_000, `RF-96: toma el monto que se dijo (${p?.montoBuscado})`);
  ok(p?.departamento === null, `RN-37: no inventa el departamento (${p?.departamento})`);
  ok(p?.duracionMeses === null && p?.presupuestoEstimado === null, `RN-37: no inventa duración ni presupuesto (${p?.duracionMeses}, ${p?.presupuestoEstimado})`);
  // Puede repetir lo que la empresa dijo de sí misma ("somos una cooperativa…"), no añadir trayectoria.
  ok(!p?.experienciaEmpresa || EXPLICACION.includes(p.experienciaEmpresa.replace(/\.$/, "")), `RN-37: la experiencia sale solo de la explicación (${JSON.stringify(p?.experienciaEmpresa)})`);
  ok((p?.faltantes ?? []).length >= 3, `RN-37: lista lo que falta (${(p?.faltantes ?? []).length})`);
  const { data: consumo } = await svc.from("consumos_ia").select("tokens_entrada, tokens_salida, costo_estimado, modelo").eq("usuario_id", id).eq("tipo", "estructuracion").single();
  console.log("consumo:", consumo);

  const f = new FormData();
  f.append("audio", new Blob([wav()], { type: "audio/wav" }), "dictado");
  f.append("segundos", "1");
  const t = await fetch(`${APP}/api/proyectos/transcribir`, { method: "POST", headers: { cookie: cookie(), origin: APP }, body: f });
  const tj = await t.json();
  console.log("transcripción:", t.status, tj);
  // Un tono no tiene palabras: 200 con texto o 422 "no logramos entender" prueban que el proveedor aceptó modelo y formato.
  ok(t.status === 200 || t.status === 422, `RF-97: el proveedor real acepta el modelo de transcripción (${t.status})`);
} catch (e) {
  console.error("Error inesperado:", e);
  fallas++;
} finally {
  if (id) {
    await svc.from("consumos_ia").delete().eq("usuario_id", id);
    await svc.auth.admin.deleteUser(id);
  }
  console.log(fallas === 0 ? "TODAS LAS COMPROBACIONES PASARON" : `${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
