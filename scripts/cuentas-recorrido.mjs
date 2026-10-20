// Cuentas temporales para recorrer las pantallas en un navegador aparte
// (Playwright contra localhost), como pide CLAUDE.md para los hitos "en las
// pantallas" (sesión 025). Sesión 027.
//
//   node --env-file=.env.local scripts/cuentas-recorrido.mjs crear  <archivo.json>
//   node --env-file=.env.local scripts/cuentas-recorrido.mjs codigo <archivo.json>   (TOTP del administrador)
//   node --env-file=.env.local scripts/cuentas-recorrido.mjs borrar <archivo.json>
//
// Crea dos empresas (trial), una consultora aprobada y un administrador por
// invitación con TOTP. El archivo guarda correos, claves y el secreto TOTP:
// debe quedar FUERA del repositorio (el directorio temporal). «borrar» quita
// las cuentas y todo lo que se haya creado en el recorrido con el sufijo en el
// nombre (fuentes, categorías, convocatorias con sus adjuntos y documentos).
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [accion, archivo] = process.argv.slice(2);
if (!archivo) throw new Error("Falta el archivo");
const b32 = (s) => { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const ch of s) bits += a.indexOf(ch).toString(2).padStart(5, "0"); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); };
const desfase = new Date((await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })).headers.get("date")).getTime() - Date.now();
const totp = (sec) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor((Date.now() + desfase) / 30000))); const h = crypto.createHmac("sha1", b32(sec)).update(c).digest(); const k = h[h.length - 1] & 15; return String((h.readUInt32BE(k) & 0x7fffffff) % 1e6).padStart(6, "0"); };

if (accion === "codigo") {
  console.log(totp(JSON.parse(fs.readFileSync(archivo, "utf8")).admin.secreto));
} else if (accion === "crear") {
  const sufijo = crypto.randomBytes(3).toString("hex");
  const clave = crypto.randomBytes(18).toString("base64url");
  const crear = async (correo, meta) => {
    const { data, error } = await svc.auth.admin.createUser({ email: correo, password: clave, email_confirm: true, user_metadata: meta });
    if (error) throw error;
    return data.user.id;
  };
  const d = { sufijo, clave };
  d.e1 = { correo: `empresa1.recorrido.${sufijo}@example.com`, nombre: `Empresa Uno ${sufijo}` };
  d.e1.id = await crear(d.e1.correo, { rol: "empresa", nombre: "Ana", nombre_empresa: d.e1.nombre, consentimiento_datos: true });
  d.e2 = { correo: `empresa2.recorrido.${sufijo}@example.com`, nombre: `Empresa Dos ${sufijo}` };
  d.e2.id = await crear(d.e2.correo, { rol: "empresa", nombre: "Beto", nombre_empresa: d.e2.nombre, consentimiento_datos: true });
  d.c1 = { correo: `consultora.recorrido.${sufijo}@example.com`, nombre: `Carla Consultora ${sufijo}` };
  d.c1.id = await crear(d.c1.correo, { rol: "consultor", nombre: "Carla", consentimiento_datos: true });
  const { error: eC } = await svc.from("consultor_perfiles")
    .update({ nombre_profesional: d.c1.nombre, descripcion: "Formulo proyectos de salud e innovación.", estado_perfil: "aprobado", sitio_web: "https://carla.example" })
    .eq("id", d.c1.id);
  if (eC) throw eC;
  const { data: prop } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
  d.admin = { correo: `admin.recorrido.${sufijo}@example.com` };
  const { data: inv, error: eI } = await svc.rpc("crear_invitacion_admin", { p_propietario: prop.id, p_correo: d.admin.correo, p_nombre: "Admin recorrido" });
  if (eI) throw eI;
  d.admin.invitacion = inv;
  d.admin.id = await crear(d.admin.correo, {});
  await svc.rpc("aceptar_invitacion_admin", { p_invitacion: inv, p_usuario: d.admin.id });
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: d.admin.correo, password: clave });
  const { data: alta } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eM } = await c.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  if (eM) throw eM;
  d.admin.secreto = alta.totp.secret;
  // Lleva claves y el secreto TOTP: solo lo lee el dueño.
  fs.writeFileSync(archivo, JSON.stringify(d, null, 2), { mode: 0o600 });
  console.log(`creado (sufijo ${sufijo})`);
} else if (accion === "borrar") {
  const d = JSON.parse(fs.readFileSync(archivo, "utf8"));
  const empresas = [d.e1.id, d.e2.id];
  const { data: convs } = await svc.from("convocatorias").select("id").ilike("nombre", `%${d.sufijo}%`);
  const ids = (convs ?? []).map((c) => c.id);
  await svc.from("calificaciones").delete().in("empresa_id", empresas);
  await svc.from("encargos").delete().in("empresa_id", empresas);
  await svc.from("documentos_generados").delete().in("usuario_id", empresas);
  await svc.from("postulaciones").delete().in("usuario_id", empresas);
  await svc.from("proyectos").delete().in("usuario_id", empresas);
  for (const id of ids) {
    const { data: archivos } = await svc.storage.from("documentos-convocatorias").list(id);
    if (archivos?.length) await svc.storage.from("documentos-convocatorias").remove(archivos.map((a) => `${id}/${a.name}`));
    await svc.from("documentos_generados").delete().eq("convocatoria_id", id);
    const { error } = await svc.from("convocatorias").delete().eq("id", id);
    if (error) console.log("convocatoria", id, error.message);
  }
  await svc.from("categorias").delete().ilike("nombre", `%${d.sufijo}%`);
  for (const id of [...empresas, d.c1.id, d.admin.id]) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log("cuenta", id, error.message);
  }
  const { error: eF } = await svc.from("fuentes").delete().ilike("nombre", `%${d.sufijo}%`);
  if (eF) console.log("fuentes", eF.message);
  await svc.from("invitaciones_admin").delete().eq("id", d.admin.invitacion);
  fs.unlinkSync(archivo);
  console.log("borrado");
}
