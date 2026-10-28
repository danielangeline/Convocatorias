// RF-56 con el modelo real de OpenAI: cuando los términos de referencia piden
// secciones, el documento sigue esas secciones, en ese orden (CU-33 · Sprint 5 ·
// sesión 027). GASTA SALDO (~USD 0,02): úsese a propósito.
//
//   npm run dev                                   (sin IA_PROVEEDOR=prueba)
//   node --env-file=.env.local scripts/prueba-estructura-ia-real.mjs
//
// Los requisitos de la base solo son documentos o condiciones (docs/05), así que
// la estructura derivada sale del TDR: este arma uno en .docx que exige cinco
// secciones con nombres poco comunes, genera con una empresa temporal y
// comprueba que las cinco aparezcan y en orden. Borra todo al terminar.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { Document, Packer, Paragraph } from "docx";
import crypto from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.PRUEBA_URL ?? "http://localhost:3000";
const BUCKET = "documentos-convocatorias";
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fallas = 0;
const ok = (c, d) => { console.log(c ? "ok   " : "FALLA", d); if (!c) fallas++; };

const SECCIONES = ["Antecedentes del territorio", "Marco lógico", "Estrategia de apropiación social", "Plan de sostenibilidad", "Presupuesto por rubros"];
const TDR = [
  "TÉRMINOS DE REFERENCIA — CONVOCATORIA DE INNOVACIÓN SOCIAL EN SALUD RURAL",
  "1. Objeto. Financiar proyectos de innovación social que mejoren el acceso a servicios de salud en zonas rurales.",
  "2. Monto. Hasta $300.000.000 por proyecto. Contrapartida mínima del 15 % del valor total.",
  "3. Contenido de la propuesta. La propuesta técnica debe presentarse con exactamente las siguientes secciones, en este orden:",
  ...SECCIONES.map((s, i) => `3.${i + 1}. ${s}.`),
  "Las propuestas que no sigan esta estructura no serán evaluadas.",
  "4. Criterios de evaluación. Pertinencia (30 puntos), calidad técnica (40 puntos), sostenibilidad (30 puntos).",
];

const sufijo = crypto.randomBytes(3).toString("hex");
let cuenta = null, convocatoria = null, ruta = null;
function sesion() {
  const jar = new Map();
  const cliente = createServerClient(URL_, ANON, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (c) => c.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) },
  });
  return { cliente, cookie: () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ") };
}
const api = async (s, metodo, r, cuerpo) => {
  const x = await fetch(APP + r, { method: metodo, redirect: "manual", headers: { "content-type": "application/json", cookie: s.cookie(), origin: APP }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  return { status: x.status, json: await x.json().catch(() => null) };
};
const norma = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

try {
  const { data: conv, error: eC } = await svc.from("convocatorias").insert({ todos_los_paises: true, // RN-39: datos de prueba abiertos a todos los países
    nombre: `Innovación social en salud rural [estructura ${sufijo}]`, entidad_convocante: "Entidad de prueba", cobertura_nacional: true,
    fecha_cierre: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), estado: "publicada", url_postulacion: "https://prueba.gov.co/estructura",
  }).select("id").single();
  if (eC) throw eC;
  convocatoria = conv.id;
  await svc.from("requisitos_convocatoria").insert([
    { convocatoria_id: convocatoria, descripcion: "RUT actualizado", tipo: "documento", obligatorio: true, orden: 0 },
    { convocatoria_id: convocatoria, descripcion: "Entidad con domicilio en Colombia", tipo: "condicion", obligatorio: true, orden: 1 },
  ]);
  const buffer = await Packer.toBuffer(new Document({ sections: [{ children: TDR.map((t) => new Paragraph(t)) }] }));
  ruta = `${convocatoria}/${crypto.randomUUID()}.docx`;
  const { error: eS } = await svc.storage.from(BUCKET).upload(ruta, buffer, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  if (eS) throw eS;
  await svc.from("documentos_convocatoria").insert({ convocatoria_id: convocatoria, nombre: "Términos de referencia", tipo_doc: "TDR", storage_path: ruta });

  const clave = crypto.randomBytes(18).toString("base64url");
  const { data: u, error: eU } = await svc.auth.admin.createUser({
    email: `estructura.ia.${sufijo}@example.com`, password: clave, email_confirm: true,
    user_metadata: { rol: "empresa", nombre: "Estructura", nombre_empresa: `Estructura IA ${sufijo}`, consentimiento_datos: true },
  });
  if (eU) throw eU;
  cuenta = u.user.id;
  const s = sesion();
  await s.cliente.auth.signInWithPassword({ email: u.user.email, password: clave });
  const { data: p } = await svc.from("proyectos").insert({
    usuario_id: cuenta, nombre: `Brigadas de salud rural ${sufijo}`, ubicacion: "Cauca",
    problema: "Las veredas del norte del Cauca están a más de tres horas del puesto de salud más cercano.",
    objetivo_general: "Acercar la atención primaria a 12 veredas mediante brigadas mensuales.",
    duracion_meses: 12, presupuesto_estimado: 280000000,
  }).select("id").single();

  const r = await api(s, "POST", "/api/documentos/generar", { proyectoId: p.id, convocatoriaId: convocatoria });
  const doc = r.json?.datos?.id ? (await api(s, "GET", `/api/documentos/${r.json.datos.id}`)).json?.datos : null;
  const titulos = doc?.secciones?.map((x) => x.titulo) ?? [];
  console.log("Secciones:", titulos.join(" | "));
  const posiciones = SECCIONES.map((sec) => titulos.findIndex((t) => norma(t).includes(norma(sec).split(" ").slice(0, 2).join(" "))));
  ok(r.status === 201 && posiciones.every((x) => x >= 0), `RF-56: aparecen las cinco secciones que pide el TDR (${posiciones.join(", ")})`);
  ok(posiciones.every((x, i) => i === 0 || x > posiciones[i - 1]), "RF-56: y en el orden del TDR");
  const { data: c } = await svc.from("consumos_ia").select("costo_estimado, creditos").eq("empresa_id", cuenta).maybeSingle();
  console.log(`Gasto: USD ${Number(c?.costo_estimado ?? 0).toFixed(4)}`);
  // Sesión 030 (§9.32): generar cobra la tarifa vigente, no 1 crédito.
  const { data: t } = await svc.from("tarifas_ia").select("creditos").eq("accion", "generacion").single();
  const { data: sus } = await svc.from("suscripciones").select("creditos_usados_periodo").eq("usuario_id", cuenta).single();
  ok(c?.creditos === t.creditos && sus.creditos_usados_periodo === t.creditos, `RN-17: la generación real cobra la tarifa (${c?.creditos} de ${t.creditos})`);
} catch (e) {
  console.error("ERROR", e);
  fallas++;
} finally {
  if (cuenta) await svc.auth.admin.deleteUser(cuenta);
  if (ruta) await svc.storage.from(BUCKET).remove([ruta]);
  if (convocatoria) {
    await svc.from("documentos_generados").delete().eq("convocatoria_id", convocatoria);
    await svc.from("convocatorias").delete().eq("id", convocatoria);
  }
  console.log(fallas === 0 ? "\nTODO PASA" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
