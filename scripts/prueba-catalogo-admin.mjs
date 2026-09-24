// Prueba de los endpoints del catálogo en el panel contra Supabase real (RF-04..06, RF-08, RF-85, RNF-28, RNF-29, RN-07).
//
//   npm run dev                                   (en otra terminal; o PRUEBA_URL=http://localhost:3100 con next start)
//   node --env-file=.env.local scripts/prueba-catalogo-admin.mjs
//
// Crea sus propias cuentas temporales —un administrador por la vía real de
// invitación, con MFA verificado, y una empresa— y llama a los endpoints con sus
// cookies, como lo haría el navegador. No toca las cuentas s004 ni el Propietario
// (solo lo usa como quien invita). Borra al terminar todo lo que crea.
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

async function api(s, metodo, ruta, cuerpo, { origen = APP } = {}) {
  const headers = { "content-type": "application/json" };
  if (s) headers.cookie = s.cookie();
  if (origen) headers.origin = origen;
  const r = await fetch(APP + ruta, { method: metodo, headers, redirect: "manual", body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], invitaciones = [], fuentes = [], categorias = [], convocatorias = [];

try {
  // --- Cuentas temporales ------------------------------------------------------
  const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
  const correoAdmin = `admin.catalogo.${sufijo}@example.com`, correoEmpresa = `empresa.catalogo.${sufijo}@example.com`;
  const clave = crypto.randomBytes(18).toString("base64url");

  const { data: invId, error: eInv } = await svc.rpc("crear_invitacion_admin", { p_propietario: propietario.id, p_correo: correoAdmin, p_nombre: "Admin catálogo" });
  if (invId) invitaciones.push(invId);
  const { data: uAdmin } = await svc.auth.admin.createUser({ email: correoAdmin, password: clave, email_confirm: true });
  cuentas.push(uAdmin.user.id);
  const { error: eAcep } = await svc.rpc("aceptar_invitacion_admin", { p_invitacion: invId, p_usuario: uAdmin.user.id });
  ok(!eInv && !eAcep, `administrador temporal creado por invitación ${eInv?.message ?? ""} ${eAcep?.message ?? ""}`);

  const { data: uEmp } = await svc.auth.admin.createUser({ email: correoEmpresa, password: clave, email_confirm: true, user_metadata: { rol: "empresa", nombre: "Empresa catálogo" } });
  cuentas.push(uEmp.user.id);

  const adm = sesion(), emp = sesion();
  await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: clave });
  await emp.cliente.auth.signInWithPassword({ email: correoEmpresa, password: clave });

  // --- RF-85 / RNF-28: el catálogo del panel no existe para los demás ----------
  ok((await api(null, "GET", "/api/admin/fuentes")).status === 404, "anónimo · GET /api/admin/fuentes → 404");
  ok((await api(emp, "GET", "/api/admin/fuentes")).status === 404, "empresa · GET /api/admin/fuentes → 404");
  ok((await api(emp, "POST", "/api/admin/fuentes", { nombre: "x" })).status === 404, "empresa · POST /api/admin/fuentes → 404");
  // Un administrador sin segundo factor no recibe datos: proxy.ts lo manda a /mfa (RNF-28).
  const rSinMfa = await fetch(APP + "/api/admin/fuentes", { headers: { cookie: adm.cookie() }, redirect: "manual" });
  ok(rSinMfa.status === 307 && new URL(rSinMfa.headers.get("location"), APP).pathname === "/mfa",
    `administrador sin MFA · GET /api/admin/fuentes → 307 a /mfa (${rSinMfa.status})`);

  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "Autenticador" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  await svc.from("invitaciones_admin").update({ estado: "aceptada", resuelta_at: new Date().toISOString() }).eq("id", invId);
  ok(!eMfa, `administrador verifica su TOTP (aal2) ${eMfa?.message ?? ""}`);

  // --- Fuentes (RF-04) ------------------------------------------------------------
  const lista = await api(adm, "GET", "/api/admin/fuentes");
  ok(lista.status === 200 && Array.isArray(lista.json?.datos), `administrador con MFA · GET /api/admin/fuentes → 200 (${lista.status})`);
  ok((await api(adm, "POST", "/api/admin/fuentes", { nombre: "x" }, { origen: "https://otro.sitio" })).status === 403, "escritura desde otro origen → 403");
  const rJs = await api(adm, "POST", "/api/admin/fuentes", { nombre: `Fuente js ${sufijo}`, url: "javascript:alert(1)" });
  ok(rJs.status === 400, `fuente con URL javascript: → 400 (${rJs.status} ${rJs.json?.error})`);
  const rSinNombre = await api(adm, "POST", "/api/admin/fuentes", { nombre: "  " });
  ok(rSinNombre.status === 400, `fuente sin nombre → 400 (${rSinNombre.status})`);

  const rF1 = await api(adm, "POST", "/api/admin/fuentes", { nombre: `MinCiencias ${sufijo}`, tipoEntidad: "Pública", url: "https://minciencias.gov.co", notas: "Revisar cada lunes" });
  if (rF1.json?.datos?.id) fuentes.push(rF1.json.datos.id);
  ok(rF1.status === 200 && rF1.json.datos.activa && rF1.json.datos.notas === "Revisar cada lunes", `crear fuente → 200 activa con notas (${rF1.status})`);
  const rF2 = await api(adm, "POST", "/api/admin/fuentes", { nombre: `Fuente vieja ${sufijo}` });
  if (rF2.json?.datos?.id) fuentes.push(rF2.json.datos.id);
  const rDesact = await api(adm, "PATCH", `/api/admin/fuentes/${rF2.json.datos.id}`, { ...rF2.json.datos, activa: false });
  ok(rDesact.status === 200 && rDesact.json.datos.activa === false, `desactivar fuente → 200 inactiva (${rDesact.status})`);
  ok((await api(adm, "PATCH", "/api/admin/fuentes/no-es-uuid", { nombre: "x" })).status === 404, "PATCH fuente con id inválido → 404");

  // --- Categorías (RF-06) ---------------------------------------------------------
  const rC1 = await api(adm, "POST", "/api/admin/categorias", { tipo: "sector", nombre: `Agro ${sufijo}` });
  if (rC1.json?.datos?.id) categorias.push(rC1.json.datos.id);
  ok(rC1.status === 200 && rC1.json.datos.activa, `crear categoría → 200 (${rC1.status})`);
  const rDup = await api(adm, "POST", "/api/admin/categorias", { tipo: "sector", nombre: `Agro ${sufijo}` });
  ok(rDup.status === 409, `categoría duplicada → 409 (${rDup.status})`);
  ok((await api(adm, "POST", "/api/admin/categorias", { tipo: "otro", nombre: "x" })).status === 400, "categoría con tipo inválido → 400");
  const rC2 = await api(adm, "POST", "/api/admin/categorias", { tipo: "tipo_proyecto", nombre: `Innovación ${sufijo}` });
  if (rC2.json?.datos?.id) categorias.push(rC2.json.datos.id);
  const rC3 = await api(adm, "POST", "/api/admin/categorias", { tipo: "sector", nombre: `Minería ${sufijo}` });
  if (rC3.json?.datos?.id) categorias.push(rC3.json.datos.id);
  const rCInact = await api(adm, "PATCH", `/api/admin/categorias/${rC3.json.datos.id}`, { activa: false });
  ok(rCInact.status === 200 && rCInact.json.datos.activa === false, `desactivar categoría → 200 (${rCInact.status})`);

  // --- Convocatorias (RF-05, RF-06, RF-08, RNF-29) -----------------------------------
  const base = { nombre: `Convocatoria prueba ${sufijo}`, entidadConvocante: "MinCiencias", fechaCierre: "2026-12-31" };
  const rInact = await api(adm, "POST", "/api/admin/convocatorias", { ...base, fuenteId: rF2.json.datos.id });
  ok(rInact.status === 400, `crear con fuente inactiva → 400 (${rInact.status} ${rInact.json?.error})`);
  const rSinFecha = await api(adm, "POST", "/api/admin/convocatorias", { ...base, fuenteId: rF1.json.datos.id, fechaCierre: "2026-02-30" });
  ok(rSinFecha.status === 400, `crear con fecha de cierre inválida → 400 (${rSinFecha.status})`);
  const rConv = await api(adm, "POST", "/api/admin/convocatorias", { ...base, fuenteId: rF1.json.datos.id, estado: "publicada" });
  const convId = rConv.json?.datos?.id;
  if (convId) convocatorias.push(convId);
  const { data: fila } = await svc.from("convocatorias").select("estado, creado_por, fuente_id").eq("id", convId).single();
  ok(rConv.status === 200 && fila?.estado === "borrador" && fila.creado_por === uAdmin.user.id,
    `crear convocatoria → borrador aunque pida publicada, con creado_por (${rConv.status} ${fila?.estado})`);
  ok((await api(emp, "POST", "/api/admin/convocatorias", { ...base, fuenteId: rF1.json.datos.id })).status === 404, "empresa · crear convocatoria → 404");

  const ficha = {
    fuenteId: rF1.json.datos.id, nombre: base.nombre, entidadConvocante: "MinCiencias", descripcion: "Objeto de prueba",
    ubicacion: "Nacional", coberturaNacional: true, urlPostulacion: "https://minciencias.gov.co/convocatoria", montoMin: "1000000", montoMax: "50000000",
    fechaApertura: "2026-09-17", fechaCierre: "2026-12-31",
    categorias: [rC1.json.datos.id, rC2.json.datos.id],
    requisitos: [
      { descripcion: "RUT actualizado", tipo: "documento", obligatorio: true },
      { descripcion: "Ser pyme", tipo: "condicion", obligatorio: false },
    ],
  };
  for (const [url, desc] of [["javascript:alert(1)", "javascript:"], ["no es un enlace", "cadena inválida"], ["https://sin-punto", "dominio malformado"], ["ftp://entidad.gov.co", "esquema ftp"]]) {
    const r = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...ficha, urlPostulacion: url });
    ok(r.status === 400, `guardar con enlace ${desc} → 400 (${r.status} ${r.json?.error ?? ""}) (RNF-29)`);
  }
  const { data: sinCambio } = await svc.from("convocatorias").select("url_postulacion").eq("id", convId).single();
  ok(sinCambio.url_postulacion === null, "tras los rechazos, el enlace sigue sin guardarse");
  const rCatInact = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...ficha, categorias: [rC3.json.datos.id] });
  ok(rCatInact.status === 400, `asignar categoría inactiva → 400 (${rCatInact.status} ${rCatInact.json?.error})`);
  const rMontos = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...ficha, montoMin: "9", montoMax: "1" });
  ok(rMontos.status === 400, `monto mínimo mayor que el máximo → 400 (${rMontos.status})`);
  // CU-02 2b (sesión 016): formato colombiano; lo ambiguo se rechaza, nunca se lee a medias.
  const rColombiano = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...ficha, montoMin: "1.000.000", montoMax: "$ 50.000.000" });
  ok(rColombiano.status === 200 && rColombiano.json.datos.montoMin === 1000000 && rColombiano.json.datos.montoMax === 50000000,
    `montos "1.000.000" y "$ 50.000.000" → 1000000 y 50000000 (${rColombiano.status} ${rColombiano.json?.datos?.montoMin})`);
  for (const malo of ["1.000000", "1.5", "1.000,50", "1e9", "-5", "mil"]) {
    const r = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...ficha, montoMin: malo });
    ok(r.status === 400 && /monto mínimo/i.test(r.json?.error ?? ""), `monto "${malo}" → 400 nombrando el campo (${r.status} ${r.json?.error})`);
  }

  // RN-34 (sesión 019): cobertura por departamentos de la lista oficial.
  const rDepMalo = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...ficha, coberturaNacional: false, departamentos: ["05", "77"] });
  ok(rDepMalo.status === 400 && /departamento/i.test(rDepMalo.json?.error ?? ""), `departamento fuera de la lista → 400 (${rDepMalo.status} ${rDepMalo.json?.error})`);
  const rAmbas = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...ficha, departamentos: ["05"] });
  ok(rAmbas.status === 400 && /nacional/i.test(rAmbas.json?.error ?? ""), `nacional y con departamentos a la vez → 400 (${rAmbas.status} ${rAmbas.json?.error})`);
  const rDeps = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...ficha, coberturaNacional: false, departamentos: ["05", "08", "05"] });
  ok(rDeps.status === 200 && !rDeps.json.datos.coberturaNacional && [...rDeps.json.datos.departamentos].sort().join(",") === "05,08",
    `dos departamentos (uno repetido) → 200 con 05 y 08 (${rDeps.status} ${rDeps.json?.datos?.departamentos})`);

  const rGuardar = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...ficha, estado: "publicada" });
  const g = rGuardar.json?.datos;
  ok(rGuardar.status === 200 && g.estado === "borrador" && g.urlPostulacion === ficha.urlPostulacion && g.montoMax === 50000000
    && g.categorias.length === 2 && g.requisitos.map((r) => r.descripcion).join("|") === "RUT actualizado|Ser pyme" && g.requisitos.every((r) => r.id),
    `guardar ficha → 200 con categorías y requisitos en orden, sin cambiar el estado (${rGuardar.status} ${rGuardar.json?.error ?? ""})`);

  // Reordenar, quitar uno y agregar otro en la misma transacción (CU-04).
  const [rut, pyme] = g.requisitos;
  const rOrden = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, {
    ...ficha,
    categorias: [rC1.json.datos.id],
    requisitos: [{ descripcion: "Cámara de comercio", tipo: "documento" }, { ...pyme, obligatorio: true }],
  });
  const o = rOrden.json?.datos;
  ok(rOrden.status === 200 && o.requisitos.map((r) => `${r.descripcion}:${r.obligatorio}`).join("|") === "Cámara de comercio:true|Ser pyme:true"
    && o.requisitos[1].id === pyme.id && !o.requisitos.some((r) => r.id === rut.id) && o.categorias.length === 1,
    `reordenar, editar, quitar y agregar requisitos → conserva el id del editado (${rOrden.status})`);

  const rAjeno = await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...ficha, requisitos: [{ id: crypto.randomUUID(), descripcion: "x", tipo: "documento" }] });
  ok(rAjeno.status === 400, `requisito con id ajeno → 400 (${rAjeno.status})`);
  ok((await api(emp, "PATCH", `/api/admin/convocatorias/${convId}`, ficha)).status === 404, "empresa · guardar convocatoria → 404");
  ok((await api(adm, "GET", `/api/admin/convocatorias/${crypto.randomUUID()}`)).status === 404, "GET convocatoria inexistente → 404");
  const rUna = await api(adm, "GET", `/api/admin/convocatorias/${convId}`);
  ok(rUna.status === 200 && rUna.json.datos.requisitos.length === 2, `GET convocatoria → 200 (${rUna.status})`);

  // --- Pantallas del panel --------------------------------------------------------
  const pagina = async (s, ruta) => { const r = await fetch(APP + ruta, { headers: s ? { cookie: s.cookie() } : {}, redirect: "manual" }); return { status: r.status, html: await r.text() }; };
  const pF = await pagina(adm, "/admin/fuentes");
  ok(pF.status === 200 && pF.html.includes(`MinCiencias ${sufijo}`), `/admin/fuentes muestra la fuente real (${pF.status})`);
  const pC = await pagina(adm, "/admin/convocatorias");
  ok(pC.status === 200 && pC.html.includes(base.nombre), `/admin/convocatorias muestra la convocatoria real (${pC.status})`);
  const pE = await pagina(adm, `/admin/convocatorias/${convId}`);
  ok(pE.status === 200 && pE.html.includes("Cámara de comercio"), `/admin/convocatorias/[id] carga requisitos reales (${pE.status})`);
  ok((await pagina(emp, "/admin/fuentes")).status === 404, "empresa · /admin/fuentes → 404");

  // --- Nombres repetidos: se comparan sin tildes ni mayúsculas (RF-04, RF-06, docs/05 §9.16) ---
  const rTilde = await api(adm, "POST", "/api/admin/categorias", { tipo: "tipo_proyecto", nombre: `Transformación ${sufijo}` });
  if (rTilde.json?.datos?.id) categorias.push(rTilde.json.datos.id);
  ok(rTilde.status === 200, `crear categoría con tilde → 200 (${rTilde.status})`);
  const rSinTilde = await api(adm, "POST", "/api/admin/categorias", { tipo: "tipo_proyecto", nombre: `Transformacion ${sufijo}` });
  ok(rSinTilde.status === 409, `la misma sin tilde → 409 (${rSinTilde.status})`);
  const rMayus = await api(adm, "POST", "/api/admin/categorias", { tipo: "tipo_proyecto", nombre: `  TRANSFORMACIÓN ${sufijo}  ` });
  ok(rMayus.status === 409, `la misma en mayúsculas y con espacios → 409 (${rMayus.status})`);
  // Mismo nombre, otro tipo: sí se admite (la unicidad es por tipo).
  const rOtroTipo = await api(adm, "POST", "/api/admin/categorias", { tipo: "sector", nombre: `Transformación ${sufijo}` });
  if (rOtroTipo.json?.datos?.id) categorias.push(rOtroTipo.json.datos.id);
  ok(rOtroTipo.status === 200, `el mismo nombre en otro tipo → 200 (${rOtroTipo.status})`);

  const rFuenteTilde = await api(adm, "POST", "/api/admin/fuentes", { nombre: `Cámara ${sufijo}` });
  if (rFuenteTilde.json?.datos?.id) fuentes.push(rFuenteTilde.json.datos.id);
  const rFuenteSin = await api(adm, "POST", "/api/admin/fuentes", { nombre: `camara ${sufijo}` });
  ok(rFuenteTilde.status === 200 && rFuenteSin.status === 409,
    `dos fuentes que solo difieren en tilde y mayúscula → 409 la segunda (${rFuenteSin.status})`);

  // --- Borrar una categoría según si la usa alguien (RN-07, v6 sesión 014) ---
  const borrable = rOtroTipo.json.datos.id;
  ok(rOtroTipo.json.datos.usos === 0, "una categoría recién creada no la usa nadie");
  ok((await api(emp, "DELETE", `/api/admin/categorias/${borrable}`)).status === 404, "empresa · borrar categoría → 404");
  ok((await api(adm, "DELETE", `/api/admin/categorias/${crypto.randomUUID()}`)).status === 404, "borrar una categoría inexistente → 404");

  // La que ya clasifica una convocatoria no se borra: 409 con el motivo.
  const enUso = rTilde.json.datos.id;
  await api(adm, "PATCH", `/api/admin/convocatorias/${convId}`, { ...ficha, categorias: [enUso] });
  const rEnUso = await api(adm, "DELETE", `/api/admin/categorias/${enUso}`);
  ok(rEnUso.status === 409 && /desact/i.test(rEnUso.json.error), `borrar una categoría en uso → 409 con el motivo ("${rEnUso.json?.error}")`);
  const listaUsos = await api(adm, "GET", "/api/admin/categorias");
  ok(listaUsos.json.datos.find((c) => c.id === enUso)?.usos === 1, "el listado dice cuántas convocatorias usan cada categoría");
  // La RLS es la barrera, no el endpoint.
  const { data: filasEnUso } = await adm.cliente.from("categorias").delete().eq("id", enUso).select("id");
  ok((filasEnUso ?? []).length === 0, "borrarla directamente en la base también falla (la política no la encuentra)");

  const rBorrar = await api(adm, "DELETE", `/api/admin/categorias/${borrable}`);
  ok(rBorrar.status === 200, `borrar una categoría que nadie usa → 200 (${rBorrar.status})`);
  ok(!(await api(adm, "GET", "/api/admin/categorias")).json.datos.some((c) => c.id === borrable), "desaparece del listado");
  ok((await api(adm, "DELETE", `/api/admin/categorias/${borrable}`)).status === 404, "borrarla dos veces → 404");

  // La pantalla ofrece borrar solo donde borrar es posible. En este punto
  // `enUso` clasifica la convocatoria y la primera categoría ya no.
  const pCat = await pagina(adm, "/admin/categorias");
  ok(pCat.status === 200 && pCat.html.includes(`Transformación ${sufijo}`), `/admin/categorias muestra la categoría real (${pCat.status})`);
  ok(!pCat.html.includes(`Borrar Transformación ${sufijo}`), "la categoría que clasifica una convocatoria no ofrece borrar");
  ok(pCat.html.includes(`Borrar ${rC1.json.datos.nombre}`), "la que ya no usa nadie sí lo ofrece");

  // RN-07: la tabla no admite borrado ni para el administrador.
  const { data: filasBorradas } = await adm.cliente.from("fuentes").delete().eq("id", rF1.json.datos.id).select("id");
  ok((filasBorradas ?? []).length === 0, "administrador con MFA · borrar una fuente directamente en la base → 0 filas (RN-07)");
} finally {
  if (convocatorias.length) await svc.from("convocatorias").delete().in("id", convocatorias);
  if (categorias.length) await svc.from("categorias").delete().in("id", categorias);
  if (fuentes.length) await svc.from("fuentes").delete().in("id", fuentes);
  for (const id of cuentas) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (invitaciones.length) await svc.from("invitaciones_admin").delete().in("id", invitaciones);
  console.log("datos y cuentas de prueba borrados");
}
console.log(fallas ? `${fallas} FALLAS` : "TODO PASÓ");
process.exitCode = fallas ? 1 : 0;
