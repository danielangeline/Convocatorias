// Pruebas de los RNF críticos contra la aplicación en marcha y Supabase real
// (RNF-01, RNF-02, RNF-03, RNF-20, RNF-30, RNF-34 · Sprint 4 paso 5).
//
//   npm run dev        (o npx next build && npx next start; PRUEBA_URL lo elige)
//   node --env-file=.env.local scripts/prueba-rnf-criticos.mjs
//
// Crea sus propias cuentas temporales —dos empresas, dos consultores y un
// administrador por invitación con MFA— y no toca las cuentas del Product
// Owner ni las de prueba de sesiones anteriores. Borra todo al terminar.
// Deja eventos `acceso_denegado` reales en eventos_seguridad: es lo que se prueba.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import crypto from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.PRUEBA_URL ?? "http://localhost:3000";
const PRODUCCION = process.env.PRODUCCION_URL ?? "https://convocatorias-neon.vercel.app";
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
  const headers = { "content-type": "application/json", origin: APP };
  if (s) headers.cookie = s.cookie();
  const r = await fetch(APP + ruta, { method: metodo, headers, redirect: "manual", body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* HTML */ }
  return { status: r.status, json, texto, destino: r.headers.get("location") ?? "" };
}
const b32 = (s) => { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const ch of s) bits += a.indexOf(ch).toString(2).padStart(5, "0"); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); };
const desfase = new Date((await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })).headers.get("date")).getTime() - Date.now();
const totp = (sec) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor((Date.now() + desfase) / 30000))); const h = crypto.createHmac("sha1", b32(sec)).update(c).digest(); const k = h[h.length - 1] & 15; return String((h.readUInt32BE(k) & 0x7fffffff) % 1e6).padStart(6, "0"); };
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const dia = (n) => new Date(Date.parse(hoy + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
// Texto visible de una página: sin scripts, estilos ni etiquetas.
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], convocatorias = [], invitaciones = [];

try {
  // --- RNF-02: cifrado en tránsito ------------------------------------------------
  const prod = await fetch(PRODUCCION, { redirect: "manual" });
  ok(prod.status === 200 && /max-age=\d+/.test(prod.headers.get("strict-transport-security") ?? ""),
    `RNF-02: producción responde por HTTPS con HSTS (${prod.status}, ${prod.headers.get("strict-transport-security")})`);
  const plano = await fetch(PRODUCCION.replace("https://", "http://"), { redirect: "manual" });
  ok([301, 307, 308].includes(plano.status) && (plano.headers.get("location") ?? "").startsWith("https://"),
    `RNF-02: HTTP redirige a HTTPS (${plano.status} -> ${plano.headers.get("location")})`);
  ok(URL_.startsWith("https://") && (await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })).ok,
    "RNF-02: Supabase solo se usa por HTTPS");

  // --- Cuentas ---------------------------------------------------------------------
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre, extra = {}) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.rnf.${sufijo}@example.com`, password: clave, email_confirm: true,
      user_metadata: { rol, nombre, consentimiento_datos: true, ...extra },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    const s = sesion();
    const { error: e } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (e) throw e;
    s.id = data.user.id;
    return s;
  };
  const e1 = await crearCuenta("empresa", "empresa1", { nombre_empresa: `Empresa RNF uno ${sufijo}` });
  const e2 = await crearCuenta("empresa", "empresa2", { nombre_empresa: `Empresa RNF dos ${sufijo}` });
  const e3 = await crearCuenta("empresa", "empresa3", { nombre_empresa: `Empresa RNF vencida ${sufijo}` });
  const c1 = await crearCuenta("consultor", "consultor1");
  const c2 = await crearCuenta("consultor", "consultor2");
  for (const [c, n] of [[c1, "Uno"], [c2, "Dos"]]) {
    await svc.from("consultor_perfiles").update({ nombre_profesional: `Consultor RNF ${n} ${sufijo}`, estado_perfil: "aprobado" }).eq("id", c.id);
  }

  const { data: propietario } = await svc.from("perfiles").select("id").eq("es_propietario", true).single();
  const correoAdmin = `admin.rnf.${sufijo}@example.com`;
  const { data: invId } = await svc.rpc("crear_invitacion_admin", { p_propietario: propietario.id, p_correo: correoAdmin, p_nombre: "Admin RNF" });
  invitaciones.push(invId);
  const { data: uAdmin } = await svc.auth.admin.createUser({ email: correoAdmin, password: clave, email_confirm: true });
  cuentas.push(uAdmin.user.id);
  await svc.rpc("aceptar_invitacion_admin", { p_invitacion: invId, p_usuario: uAdmin.user.id });
  const adm = sesion();
  await adm.cliente.auth.signInWithPassword({ email: correoAdmin, password: clave });
  // RNF-28: sin segundo factor, el panel lleva a /mfa.
  const sinMfa = await api(adm, "GET", "/admin");
  ok(sinMfa.status === 307 && sinMfa.destino.endsWith("/mfa"), `RNF-28: administrador sin MFA -> /mfa (${sinMfa.status} ${sinMfa.destino})`);
  const { data: alta } = await adm.cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "A" });
  const { error: eMfa } = await adm.cliente.auth.mfa.challengeAndVerify({ factorId: alta.id, code: totp(alta.totp.secret) });
  ok(!eMfa, `RNF-28: con el TOTP verificado la sesión es aal2 ${eMfa?.message ?? ""}`);

  // --- RNF-30 / RNF-01: matriz rol × ruta -----------------------------------------
  const contarDenegados = async () => (await svc.from("eventos_seguridad").select("id", { count: "exact", head: true }).eq("tipo", "acceso_denegado")).count;
  const denegadosAntes = await contarDenegados();
  const EMP = ["/convocatorias", "/proyectos", "/postulaciones", "/consultores", "/encargos", "/api/proyectos", "/api/postulaciones", "/api/encargos", "/api/consultores", "/api/convocatorias"];
  const CON = ["/consultor/perfil", "/consultor/encargos", "/api/consultor/perfil", "/api/consultor/encargos"];
  const PANEL = ["/admin", "/admin/encargos", "/admin/consultores", "/admin/convocatorias", "/api/admin/encargos", "/api/admin/consultores", "/api/admin/convocatorias"];
  const PROPIETARIO = ["/admin/administradores", "/api/admin/administradores"];
  const esperado = (quien, ruta) => {
    const panel = PANEL.includes(ruta) || PROPIETARIO.includes(ruta);
    if (quien === "anon") return panel ? 404 : 307;
    if (quien === "admin") return PROPIETARIO.includes(ruta) ? 404 : panel ? 200 : 403;
    if (panel) return 404;
    return (quien === "empresa" ? EMP : CON).includes(ruta) ? 200 : 403;
  };
  const roles = [["anon", null], ["empresa", e1], ["consultor", c1], ["admin", adm]];
  let comprobadas = 0;
  for (const ruta of [...EMP, ...CON, ...PANEL, ...PROPIETARIO]) {
    for (const [quien, s] of roles) {
      const r = await api(s, "GET", ruta);
      const quiere = esperado(quien, ruta);
      comprobadas++;
      if (r.status !== quiere) ok(false, `RNF-30: ${quien} ${ruta} -> ${r.status} (esperaba ${quiere})`);
    }
  }
  ok(true, `RNF-30: matriz rol × ruta, ${comprobadas} combinaciones revisadas (las que no coinciden salen arriba)`);
  ok((await api(e1, "GET", "/api/no-existe")).status === 404 && (await api(e1, "GET", "/ruta-inventada")).status === 404,
    "RNF-30: una ruta no declarada responde 404 (cerrado por defecto)");
  const panelEmpresa = await api(e1, "GET", "/api/admin/consultores");
  const inventada = await api(e1, "GET", "/api/admin/no-existe-en-absoluto");
  // Next repite la ruta pedida (entera y por segmentos) y pone un id aleatorio por petición: se quitan
  // los dos antes de comparar; lo demás debe ser idéntico.
  const normal = (t, ruta) => {
    const ultimo = ruta.split("/").pop();
    return t.split(ruta).join("<RUTA>").split(ultimo).join("<SEGMENTO>").replace(/__next_r="[^"]*"/g, "");
  };
  ok(panelEmpresa.status === 404 && normal(panelEmpresa.texto, "/api/admin/consultores") === normal(inventada.texto, "/api/admin/no-existe-en-absoluto"),
    "RNF-01, RNF-35: el panel responde a la empresa igual que una ruta inexistente");
  const denegadosDespues = await contarDenegados();
  ok(denegadosDespues > denegadosAntes, `RNF-30: los rechazos quedan como acceso_denegado (${denegadosDespues - denegadosAntes} nuevos)`);
  const { data: ultimo } = await svc.from("eventos_seguridad").select("usuario_id, ruta").eq("tipo", "acceso_denegado").eq("usuario_id", c1.id).limit(1);
  ok(ultimo?.length === 1, "RNF-30: el evento identifica a quién se le negó");

  // --- RNF-03: datos de dos empresas y dos consultores ------------------------------
  const { data: conv } = await svc.from("convocatorias").insert({
    nombre: `Convocatoria RNF ${sufijo}`, entidad_convocante: "Entidad RNF", cobertura_nacional: true,
    fecha_cierre: dia(20), estado: "publicada", url_postulacion: "https://prueba.gov.co/rnf",
  }).select("id").single();
  convocatorias.push(conv.id);
  await svc.from("requisitos_convocatoria").insert({ convocatoria_id: conv.id, descripcion: "RUT", tipo: "documento", obligatorio: true, orden: 0 });

  const datosDe = async (e, c, n) => {
    const p = (await api(e, "POST", "/api/proyectos", { nombre: `Proyecto RNF ${n} ${sufijo}` })).json?.datos;
    const po = (await api(e, "POST", "/api/postulaciones", { convocatoriaId: conv.id, proyectoId: p.id })).json?.datos;
    const en = (await api(e, "POST", "/api/encargos", { proyectoId: p.id, consultorId: c.id, tipoAyuda: "buscar_convocatoria", titulo: `Tarea RNF ${n} ${sufijo}` })).json?.datos;
    await api(c, "POST", `/api/consultor/encargos/${en.id}/responder`, { acepta: true });
    return { proyecto: p.id, postulacion: po.id, encargo: en.id, nombre: n };
  };
  const d1 = await datosDe(e1, c1, "uno"), d2 = await datosDe(e2, c2, "dos");
  ok(d1.proyecto && d1.postulacion && d1.encargo && d2.encargo, "RNF-03: cada empresa tiene proyecto, postulación y encargo aceptado por su consultor");

  const listados = [["/api/proyectos", "proyecto"], ["/api/postulaciones", "postulacion"], ["/api/encargos", "encargo"]];
  for (const [e, propio, ajeno, quien] of [[e1, d1, d2, "empresa uno"], [e2, d2, d1, "empresa dos"]]) {
    for (const [ruta, clave] of listados) {
      const ids = ((await api(e, "GET", ruta)).json?.datos ?? []).map((x) => x.id);
      ok(ids.includes(propio[clave]) && !ids.includes(ajeno[clave]), `RNF-03: ${quien} en ${ruta} ve lo suyo y nada ajeno`);
    }
    ok((await api(e, "GET", `/api/proyectos/${ajeno.proyecto}`)).status === 404 && (await api(e, "GET", `/api/postulaciones/${ajeno.postulacion}`)).status === 404,
      `RNF-03: ${quien} pide por id el proyecto y la postulación ajenos -> 404`);
    ok((await api(e, "POST", `/api/encargos/${ajeno.encargo}/retirar`)).status === 404, `RNF-03: ${quien} no actúa sobre el encargo ajeno -> 404`);
    for (const pagina of ["/proyectos", "/postulaciones", "/encargos"]) {
      const t = visible((await api(e, "GET", pagina)).texto);
      ok(t.includes(`RNF ${propio.nombre} ${sufijo}`) && !t.includes(`RNF ${ajeno.nombre} ${sufijo}`), `RNF-03: ${quien} en la pantalla ${pagina} solo ve lo suyo`);
    }
  }
  for (const [c, propio, ajeno, quien] of [[c1, d1, d2, "consultor uno"], [c2, d2, d1, "consultor dos"]]) {
    const ids = ((await api(c, "GET", "/api/consultor/encargos")).json?.datos ?? []).map((x) => x.id);
    ok(ids.includes(propio.encargo) && !ids.includes(ajeno.encargo), `RNF-03: ${quien} solo ve su encargo`);
    ok((await api(c, "POST", `/api/consultor/encargos/${ajeno.encargo}/avances`, { nota: "x" })).status === 404, `RNF-03: ${quien} no escribe en el encargo ajeno -> 404`);
    const { data: proyectosVistos } = await c.cliente.from("proyectos").select("id").in("id", [propio.proyecto, ajeno.proyecto]);
    ok(proyectosVistos?.length === 1 && proyectosVistos[0].id === propio.proyecto, `RNF-03: ${quien} lee de la tabla solo el proyecto de su encargo (RN-25)`);
  }

  // --- RNF-20: suscripción en el servidor -------------------------------------------
  const p3 = (await api(e3, "POST", "/api/proyectos", { nombre: `Proyecto RNF vencida ${sufijo}` })).json?.datos;
  await svc.from("suscripciones").update({ estado: "vencida", fecha_inicio: dia(-40), fecha_vencimiento: dia(-30) }).eq("usuario_id", e3.id);
  const postular = await api(e3, "POST", "/api/postulaciones", { convocatoriaId: conv.id, proyectoId: p3.id });
  const sugerir = await api(e3, "GET", `/api/proyectos/${p3.id}/sugerencias`);
  const solicitar = await api(e3, "POST", "/api/encargos", { proyectoId: p3.id, consultorId: c1.id, tipoAyuda: "buscar_convocatoria", titulo: "x" });
  ok(postular.status === 402 && sugerir.status === 402 && solicitar.status === 402,
    `RNF-20: sin suscripción, la API directa rechaza postular, sugerencias y solicitar (${postular.status}, ${sugerir.status}, ${solicitar.status})`);
  const { error: eDirecto } = await e3.cliente.from("postulaciones").insert({ usuario_id: e3.id, convocatoria_id: conv.id, proyecto_id: p3.id });
  ok(Boolean(eDirecto), "RNF-20: y la RLS lo rechaza aunque se salte la API");
  ok((await api(e3, "GET", "/convocatorias")).status === 200, "RNF-20: el catálogo sigue disponible (CU-32)");

  // --- RNF-34: sin identificadores de la especificación en pantalla -----------------
  const paginas = [
    [null, ["/", "/login", "/registro", "/registro?puerta=consultor"]],
    [e1, ["/convocatorias", `/convocatorias/${conv.id}`, "/proyectos", `/proyectos/${d1.proyecto}`, `/postulaciones/${d1.postulacion}`, "/postulaciones", "/consultores", `/consultores/${c1.id}`, "/encargos", "/suscripcion"]],
    [c1, ["/consultor/perfil", "/consultor/encargos", "/consultor/suscripcion"]],
    [adm, ["/admin", "/admin/encargos", "/admin/consultores", "/admin/consultores/revision", "/admin/convocatorias", "/admin/fuentes", "/admin/categorias"]],
  ];
  const patron = /\b(CU|RF|RNF|RN)-\d{2}\b/g;
  let revisadas = 0;
  for (const [s, rutas] of paginas) {
    for (const ruta of rutas) {
      const r = await api(s, "GET", ruta);
      const hallados = [...new Set(visible(r.texto).match(patron) ?? [])];
      revisadas++;
      if (r.status !== 200 || hallados.length) ok(false, `RNF-34: ${ruta} -> ${r.status}, identificadores visibles: ${hallados.join(", ") || "ninguno"}`);
    }
  }
  ok(true, `RNF-34: ${revisadas} pantallas de los tres portales revisadas (las que fallan salen arriba)`);
} catch (err) {
  fallas++;
  console.error("FALLA inesperada:", err);
} finally {
  if (cuentas.length) {
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
  if (invitaciones.length) await svc.from("invitaciones_admin").delete().in("id", invitaciones);
  console.log(fallas === 0 ? "\nTODO PASA" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
