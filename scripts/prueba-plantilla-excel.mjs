// Prueba de la plantilla en Excel de la carga masiva, contra Supabase real (CU-50 2a, RF-118, RF-85).
//
//   npm run dev                                   (en otra terminal; o PRUEBA_URL=http://localhost:3100 con next start)
//   node --env-file=.env.local scripts/prueba-plantilla-excel.mjs
//
// Crea sus propias cuentas temporales —un administrador por la vía real de
// invitación, con MFA verificado, y una empresa—, descarga la plantilla y la
// abre con ExcelJS. Guarda la descargada en docs/evidencias/sesion-039/. Borra
// al terminar las cuentas que crea.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import ExcelJS from "exceljs";
import crypto from "node:crypto";
import fs from "node:fs";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.PRUEBA_URL ?? "http://localhost:3000";
const RUTA = "/api/admin/convocatorias/carga-masiva/plantilla";
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
const bajar = (s) => fetch(APP + RUTA, { headers: s ? { cookie: s.cookie() } : {}, redirect: "manual" });

// Las columnas de la plantilla, tal como las declara lib/admin/carga-masiva.ts.
const claves = [...fs.readFileSync("lib/admin/carga-masiva.ts", "utf8").matchAll(/\{ clave: "(\w+)"/g)].map((m) => m[1]);

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], invitaciones = [];

try {
  const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
  const correoAdmin = `admin.plantilla.${sufijo}@example.com`, correoEmpresa = `empresa.plantilla.${sufijo}@example.com`;
  const clave = crypto.randomBytes(18).toString("base64url");
  const { data: invId } = await svc.rpc("crear_invitacion_admin", { p_propietario: propietario.id, p_correo: correoAdmin, p_nombre: "Admin plantilla" });
  invitaciones.push(invId);
  const { data: uAdmin } = await svc.auth.admin.createUser({ email: correoAdmin, password: clave, email_confirm: true });
  cuentas.push(uAdmin.user.id);
  await svc.rpc("aceptar_invitacion_admin", { p_invitacion: invId, p_usuario: uAdmin.user.id });
  const { data: uEmp } = await svc.auth.admin.createUser({ email: correoEmpresa, password: clave, email_confirm: true, user_metadata: { rol: "empresa", nombre: "Empresa plantilla" } });
  cuentas.push(uEmp.user.id);

  const adm = sesion(), emp = sesion();
  await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: clave });
  await emp.cliente.auth.signInWithPassword({ email: correoEmpresa, password: clave });

  // --- RF-85: el endpoint no existe para los demás ----------------------------
  ok((await bajar(null)).status === 404, "anónimo → 404");
  ok((await bajar(emp)).status === 404, "empresa → 404");
  const sinMfa = await bajar(adm);
  ok(sinMfa.status === 307, `administrador sin MFA → 307 a /mfa (${sinMfa.status})`);

  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  await svc.from("invitaciones_admin").update({ estado: "aceptada", resuelta_at: new Date().toISOString() }).eq("id", invId);
  ok(!eMfa, "administrador verifica su TOTP (aal2)");

  // --- La descarga --------------------------------------------------------------
  const r = await bajar(adm);
  ok(r.status === 200, `administrador con MFA → 200 (${r.status})`);
  ok(r.headers.get("content-type")?.includes("spreadsheetml"), "tipo .xlsx");
  const disposicion = r.headers.get("content-disposition") ?? "";
  ok(/attachment; filename="plantilla-convocatorias-\d{4}-\d{2}-\d{2}\.xlsx"/.test(disposicion), `nombre con la fecha (${disposicion})`);
  ok(r.headers.get("cache-control") === "no-store", "no se guarda en caché");
  const bytes = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync("docs/evidencias/sesion-039", { recursive: true });
  fs.writeFileSync("docs/evidencias/sesion-039/plantilla-descargada.xlsx", bytes);

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes);
  ok(JSON.stringify(libro.worksheets.map((h) => h.name)) === JSON.stringify(["Convocatorias", "Prompt para el agente", "Guía de columnas", "Listas válidas"]), "las cuatro hojas, la de carga primero");

  const hoja = libro.getWorksheet("Convocatorias");
  const encabezados = hoja.getRow(1).values.slice(1);
  ok(JSON.stringify(encabezados) === JSON.stringify(claves), `fila 1 = las ${claves.length} columnas de COLUMNAS_CARGA, en orden`);
  ok(hoja.actualRowCount === 1, "sin fila de ejemplo (el importador la rechazaría)");
  ok(hoja.getCell("A2").numFmt === "@", "celdas en formato texto");
  const tipoCol = claves.indexOf("tipo") + 1;
  ok(hoja.getCell(2, tipoCol).dataValidation?.formulae?.[0] === '"fondo,beneficio_tributario"', "desplegable de tipo");

  const prompt = libro.getWorksheet("Prompt para el agente").getColumn(1).values.filter(Boolean).join("\n");
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  ok(prompt.includes(`fecha de hoy: ${hoy}`), "el prompt trae la fecha de hoy en Colombia");
  ok(prompt.includes("=TDR") && prompt.includes("NO INVENTES NADA"), "el prompt exige el TDR y prohíbe inventar");
  ok(claves.every((c) => prompt.includes(`. ${c}`)), "el prompt explica todas las columnas");

  const listas = libro.getWorksheet("Listas válidas");
  const [{ data: fuentes }, { data: categorias }, { count: nPaises }] = await Promise.all([
    svc.from("fuentes").select("nombre").eq("activa", true),
    svc.from("categorias").select("nombre").eq("activa", true),
    svc.from("paises").select("codigo", { count: "exact", head: true }),
  ]);
  const columna = (n) => listas.getColumn(n).values.slice(3).filter(Boolean);
  ok(JSON.stringify(columna(1).sort()) === JSON.stringify(fuentes.map((f) => f.nombre).sort()), `fuentes activas de la base (${fuentes.length})`);
  ok(JSON.stringify(columna(3).sort()) === JSON.stringify(categorias.map((c) => c.nombre).sort()), `categorías activas de la base (${categorias.length})`);
  ok(columna(6).length === 33 && columna(6).includes("05"), "33 departamentos con su código DANE");
  ok(columna(12).length === nPaises, `países de la base (${nPaises})`);
} finally {
  for (const id of cuentas) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (invitaciones.length) await svc.from("invitaciones_admin").delete().in("id", invitaciones);
  console.log("cuentas de prueba borradas");
}
console.log(fallas ? `${fallas} FALLAS` : "TODO PASÓ");
process.exitCode = fallas ? 1 : 0;
