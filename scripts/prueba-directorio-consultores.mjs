// Prueba del directorio de consultores y el perfil público contra Supabase
// real (RF-26, RF-27, RF-80, CU-20, CU-21, RN-12, RNF-16, RNF-30 · docs/05
// §9.22 · Sprint 4 paso 1c).
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-directorio-consultores.mjs
//
// Crea sus propias cuentas temporales: dos empresas y cuatro consultores con
// foto y hoja de vida de verdad (uno aprobado, uno del equipo interno, uno en
// revisión y uno suspendido). Los estados y los encargos se fijan con
// service_role: la aceptación de encargos llega en el paso 3. Borra todo al
// terminar.
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

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const sufijo = crypto.randomBytes(3).toString("hex");
const pdfDe = (quien) => Buffer.from(`%PDF-1.4\n% hoja de vida de ${quien} ${sufijo}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`);
const cuentas = [], categorias = [];

async function subir(s, tipo, cuerpo, contentType) {
  const firma = await api(s, "POST", "/api/consultor/perfil/archivos/subida", { tipo, nombreArchivo: tipo === "foto" ? "foto.png" : "cv.pdf", tamanoBytes: cuerpo.length });
  const bucket = tipo === "foto" ? "fotos-consultores" : "hojas-de-vida";
  await s.cliente.storage.from(bucket).uploadToSignedUrl(firma.json.datos.ruta, firma.json.datos.token, cuerpo, { contentType });
  return api(s, "POST", "/api/consultor/perfil/archivos", { tipo, ruta: firma.json.datos.ruta });
}

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre, extra = {}) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.directorio.${sufijo}@example.com`, password: clave, email_confirm: true,
      user_metadata: { rol, nombre, ...extra },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    const s = sesion();
    const { error: e } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (e) throw e;
    s.id = data.user.id;
    return s;
  };

  const { data: catA } = await svc.from("categorias").insert({ tipo: "sector", nombre: `Sector directorio A ${sufijo}`, activa: true }).select("id").single();
  const { data: catB } = await svc.from("categorias").insert({ tipo: "sector", nombre: `Sector directorio B ${sufijo}`, activa: true }).select("id").single();
  categorias.push(catA.id, catB.id);

  const e1 = await crearCuenta("empresa", "empresa1", { nombre_empresa: "Empresa 1", consentimiento_datos: true });
  const e2 = await crearCuenta("empresa", "empresa2", { nombre_empresa: "Empresa 2", consentimiento_datos: true });

  const consultor = async (letra, nombre, estado, extra = {}) => {
    const s = await crearCuenta("consultor", `consultor-${letra}`, { consentimiento_datos: true });
    s.nombre = nombre;
    s.sitio = `https://${letra}-${sufijo}.co`;
    s.red = `https://linkedin.com/in/${letra}-${sufijo}`;
    await api(s, "PATCH", "/api/consultor/perfil", {
      nombreProfesional: nombre, descripcion: `Formulo proyectos de innovación (${letra})`, sitioWeb: s.sitio,
      especialidades: [catA.id], redes: [{ tipo: "linkedin", url: s.red }],
      portafolio: [{ nombreProyecto: `Plataforma de ${letra}`, entidad: "iNNpulsa", anio: 2025, resultado: "Financiado" }],
    });
    await subir(s, "foto", PNG, "image/png");
    await subir(s, "cv", pdfDe(letra), "application/pdf");
    await api(s, "POST", "/api/consultor/perfil/enviar-revision", {});
    // Los estados se fijan con service_role: la bandeja ya se probó en el paso 1b.
    const { error } = await svc.from("consultor_perfiles").update({ estado_perfil: estado, ...extra }).eq("id", s.id);
    if (error) throw error;
    return s;
  };
  const a = await consultor("a", `Ángela Ruiz ${sufijo}`, "aprobado");
  const b = await consultor("b", `Interno Beta ${sufijo}`, "aprobado", { es_equipo_interno: true });
  const c = await consultor("c", `En Revisión ${sufijo}`, "en_revision");
  const d = await consultor("d", `Suspendido Delta ${sufijo}`, "suspendido", { motivo_suspension: "prueba", suspendido_at: new Date().toISOString() });

  // --- RNF-30: el directorio es del portal Empresa ------------------------------------
  const anon = await api(null, "GET", "/api/consultores");
  const comoConsultor = await api(a, "GET", "/api/consultores");
  ok(anon.status === 307 && /\/login/.test(anon.destino ?? "") && !anon.json?.datos, `anónimo -> redirige a /login, como el catálogo (${anon.status})`);
  ok(comoConsultor.status === 403 && !comoConsultor.json?.datos, `consultor -> 403 (${comoConsultor.status})`);
  ok((await api(a, "GET", `/api/consultores/${a.id}`)).status === 403, "el consultor tampoco abre un perfil del directorio");

  // --- RF-26: quién aparece --------------------------------------------------------------
  const lista = await api(e1, "GET", "/api/consultores");
  const ids = (lista.json?.datos ?? []).map((x) => x.id);
  ok(lista.status === 200 && ids.includes(a.id), "el aprobado externo aparece");
  ok(!ids.includes(b.id), "el del equipo interno no aparece");
  ok(!ids.includes(c.id), "el que está en revisión no aparece");
  ok(!ids.includes(d.id), "el suspendido no aparece");
  const tarjeta = (lista.json?.datos ?? []).find((x) => x.id === a.id);
  ok(tarjeta?.especialidades?.[0]?.id === catA.id && tarjeta?.nombreProfesional === a.nombre, "la tarjeta trae nombre y especialidad");
  const foto = tarjeta?.fotoUrl ? await fetch(tarjeta.fotoUrl) : null;
  ok(/\/sign\/fotos-consultores\//.test(tarjeta?.fotoUrl ?? "") && foto?.status === 200, "la foto llega firmada y se descarga");
  ok(!lista.texto.includes(a.sitio) && !lista.texto.includes(a.red) && !lista.texto.includes("hojas-de-vida"),
    "el listado no trae sitio web, redes ni hoja de vida");

  // Filtros (RF-26).
  const porEsp = await api(e1, "GET", `/api/consultores?especialidad=${catA.id}`);
  const porOtra = await api(e1, "GET", `/api/consultores?especialidad=${catB.id}`);
  ok(porEsp.json?.datos?.some((x) => x.id === a.id) && !porOtra.json?.datos?.some((x) => x.id === a.id), "filtro por especialidad");
  const porNombre = await api(e1, "GET", `/api/consultores?q=${encodeURIComponent("angela ruiz " + sufijo)}`);
  ok(porNombre.json?.datos?.length === 1 && porNombre.json.datos[0].id === a.id, "búsqueda por nombre sin tildes ni mayúsculas");
  const porRating = await api(e1, "GET", "/api/consultores?ratingMin=4.5");
  ok(!porRating.json?.datos?.some((x) => x.id === a.id), "filtro por rating mínimo (A no tiene reseñas aún)");
  ok((await api(e1, "GET", "/api/consultores?especialidad=no-es-uuid")).status === 400, "especialidad inválida -> 400");
  ok((await api(e1, "GET", "/api/consultores?ratingMin=9")).status === 400, "rating fuera de rango -> 400");

  // --- CU-21: perfil público sin contacto --------------------------------------------------
  const perfil = await api(e1, "GET", `/api/consultores/${a.id}`);
  const p = perfil.json?.datos;
  ok(perfil.status === 200 && p?.descripcion?.includes("(a)") && p?.portafolio?.[0]?.resultado === "Financiado" && p?.fotoUrl,
    "el perfil trae foto, descripción y portafolio");
  ok(p?.contacto === null && !perfil.texto.includes(a.sitio) && !perfil.texto.includes(a.red), "sin encargo, ningún dato de contacto");
  for (const [quien, id] of [["equipo interno", b.id], ["en revisión", c.id], ["suspendido", d.id], ["inexistente", crypto.randomUUID()], ["id inválido", "x"]]) {
    ok((await api(e1, "GET", `/api/consultores/${id}`)).status === 404, `perfil ${quien} -> 404`);
  }
  ok((await api(e1, "GET", `/api/consultores/${a.id}/cv`)).status === 404, "hoja de vida sin encargo -> 404");
  const pagina = await api(e1, "GET", `/consultores/${a.id}`);
  ok(pagina.status === 200 && pagina.texto.includes("cuando el consultor acepte") && !pagina.texto.includes(a.red),
    "la pantalla del perfil explica que el contacto llega al aceptar");
  const directorio = await api(e1, "GET", "/consultores");
  ok(directorio.status === 200 && directorio.texto.includes(a.nombre) && !directorio.texto.includes(b.nombre), "la pantalla del directorio muestra a A y no al interno");

  // --- RF-80: pendiente no revela; en curso sí, solo a esa empresa ---------------------------
  const { data: proyecto } = await svc.from("proyectos").insert({ usuario_id: e1.id, nombre: `Proyecto directorio ${sufijo}` }).select("id").single();
  const { data: encargo, error: eEnc } = await svc.from("encargos").insert({
    proyecto_id: proyecto.id, empresa_id: e1.id, consultor_id: a.id, titulo_tarea: "Revisar", via: "directorio", estado: "pendiente", tipo_ayuda: "buscar_convocatoria",
  }).select("id").single();
  ok(!eEnc, `encargo pendiente sembrado ${eEnc?.message ?? ""}`);
  const conPendiente = await api(e1, "GET", `/api/consultores/${a.id}`);
  ok(conPendiente.json?.datos?.contacto === null && (await api(e1, "GET", `/api/consultores/${a.id}/cv`)).status === 404,
    "con la solicitud pendiente sigue sin contacto");

  await svc.from("encargos").update({ estado: "en_curso", aceptado_at: new Date().toISOString() }).eq("id", encargo.id);
  const aceptado = await api(e1, "GET", `/api/consultores/${a.id}`);
  const k = aceptado.json?.datos?.contacto;
  ok(k?.sitioWeb === a.sitio && k?.redes?.[0]?.url === a.red && k?.tieneHojaDeVida === true, "aceptado: la empresa ve sitio web, redes y hoja de vida");
  const cv = await api(e1, "GET", `/api/consultores/${a.id}/cv`);
  const archivo = cv.json?.datos?.url ? Buffer.from(await (await fetch(cv.json.datos.url)).arrayBuffer()).toString() : "";
  ok(cv.status === 200 && cv.json.datos.url.includes(`/sign/hojas-de-vida/${a.id}/`) && archivo.includes(`hoja de vida de a ${sufijo}`),
    "aceptado: la hoja de vida por URL firmada es el archivo exacto");
  const paginaAceptado = await api(e1, "GET", `/consultores/${a.id}`);
  ok(paginaAceptado.texto.includes(a.red) && paginaAceptado.texto.includes("Ver hoja de vida"), "aceptado: la pantalla muestra el contacto");

  const otra = await api(e2, "GET", `/api/consultores/${a.id}`);
  ok(otra.json?.datos?.contacto === null && (await api(e2, "GET", `/api/consultores/${a.id}/cv`)).status === 404,
    "otra empresa no ve el contacto por el encargo ajeno (pareja, RN-12)");
  const rutaCv = decodeURIComponent(new URL(cv.json.datos.url).pathname.split("/sign/hojas-de-vida/")[1]);
  const { error: eE2 } = await e2.cliente.storage.from("hojas-de-vida").createSignedUrl(rutaCv, 60);
  ok(Boolean(eE2), "otra empresa tampoco firma la hoja de vida desde Storage");
  const { data: fotoC } = await svc.from("consultor_perfiles").select("foto_path").eq("id", c.id).single();
  const { error: eFotoC } = await e1.cliente.storage.from("fotos-consultores").createSignedUrl(fotoC.foto_path, 60);
  ok(Boolean(eFotoC), "la empresa no firma la foto de un perfil que no está aprobado");

  // --- Reseñas (CU-21 paso 1) y cierre del encargo -------------------------------------------
  await svc.from("encargos").update({ estado: "completado", completado_at: new Date().toISOString() }).eq("id", encargo.id);
  const { error: eCal } = await svc.from("calificaciones").insert({ encargo_id: encargo.id, consultor_id: a.id, empresa_id: e1.id, estrellas: 5, comentario: `Excelente trabajo ${sufijo}` });
  ok(!eCal, `calificación sembrada ${eCal?.message ?? ""}`);
  const cerrado = await api(e2, "GET", `/api/consultores/${a.id}`);
  const r = cerrado.json?.datos;
  ok(r?.ratingPromedio === 5 && r?.totalEncargosCompletados === 1 && r?.resenas?.[0]?.comentario === `Excelente trabajo ${sufijo}`,
    "el perfil trae rating, encargos completados y la reseña");
  ok(!("empresaId" in (r?.resenas?.[0] ?? {})) && !cerrado.texto.includes(e1.id), "la reseña no dice qué empresa calificó");
  const trasCerrar = await api(e1, "GET", `/api/consultores/${a.id}`);
  ok(trasCerrar.json?.datos?.contacto === null && (await api(e1, "GET", `/api/consultores/${a.id}/cv`)).status === 404,
    "al completarse el encargo, el contacto se vuelve a ocultar");
  const conRating = await api(e1, "GET", "/api/consultores?ratingMin=4.5");
  ok(conRating.json?.datos?.some((x) => x.id === a.id), "con la reseña, A entra en el filtro de rating 4.5");
} catch (e) {
  fallas++;
  console.error("FALLA inesperada:", e);
} finally {
  if (cuentas.length) {
    await svc.from("calificaciones").delete().in("empresa_id", cuentas);
    await svc.from("encargos").delete().in("empresa_id", cuentas);
    await svc.from("proyectos").delete().in("usuario_id", cuentas);
  }
  for (const id of [...cuentas].reverse()) {
    for (const bucket of ["fotos-consultores", "hojas-de-vida"]) {
      const { data } = await svc.storage.from(bucket).list(id);
      if (data?.length) await svc.storage.from(bucket).remove(data.map((o) => `${id}/${o.name}`));
    }
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (categorias.length) await svc.from("categorias").delete().in("id", categorias);
  console.log(fallas === 0 ? "\nTODO PASA" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
