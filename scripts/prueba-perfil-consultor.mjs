// Prueba del perfil del consultor contra Supabase real (RF-22, RF-23, RF-24,
// RF-25, RF-88, CU-15..17, RN-12, RNF-16, RNF-30 · docs/05 §9.20 · Sprint 4
// paso 1a).
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-perfil-consultor.mjs
//
// Crea sus propias cuentas temporales (dos consultores —uno sin
// consentimiento— y una empresa) y dos categorías. Sube una foto y una hoja de
// vida de verdad. Borra todo al terminar.
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

// Un PNG de 1×1 y un PDF mínimo: Storage valida el tipo declarado, no el contenido.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], categorias = [];

async function subir(s, tipo, nombreArchivo, cuerpo, contentType) {
  const firma = await api(s, "POST", "/api/consultor/perfil/archivos/subida", { tipo, nombreArchivo, tamanoBytes: cuerpo.length });
  if (firma.status !== 200) return { firma };
  const bucket = tipo === "foto" ? "fotos-consultores" : "hojas-de-vida";
  const { error } = await s.cliente.storage.from(bucket).uploadToSignedUrl(firma.json.datos.ruta, firma.json.datos.token, cuerpo, { contentType });
  if (error) return { firma, eSubida: error };
  const registro = await api(s, "POST", "/api/consultor/perfil/archivos", { tipo, ruta: firma.json.datos.ruta });
  return { firma, registro, ruta: firma.json.datos.ruta };
}

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre, extra = {}) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.perfil.${sufijo}@example.com`, password: clave, email_confirm: true,
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
  const a = await crearCuenta("consultor", "consultora-a", { consentimiento_datos: true });
  const b = await crearCuenta("consultor", "consultor-b");  // cuenta "anterior": sin consentimiento
  const emp = await crearCuenta("empresa", "empresa", { nombre_empresa: "Empresa prueba", consentimiento_datos: true });

  const { data: cat1 } = await svc.from("categorias").insert({ tipo: "sector", nombre: `Agro perfil ${sufijo}`, activa: true }).select("id").single();
  const { data: cat2 } = await svc.from("categorias").insert({ tipo: "tipo_proyecto", nombre: `Innovación perfil ${sufijo}`, activa: true }).select("id").single();
  categorias.push(cat1.id, cat2.id);

  // --- RNF-30: quién llega ---------------------------------------------------------------
  const anon = await api(null, "GET", "/api/consultor/perfil");
  ok(anon.status === 307 && /\/login/.test(anon.destino ?? ""), `visitante - GET /api/consultor/perfil -> /login (${anon.status})`);
  ok((await api(emp, "GET", "/api/consultor/perfil")).status === 403, "empresa - GET /api/consultor/perfil -> 403");
  ok((await api(emp, "PATCH", "/api/consultor/perfil", { nombreProfesional: "x" })).status === 403, "empresa - PATCH -> 403");
  ok((await api(a, "PATCH", "/api/consultor/perfil", { nombreProfesional: "x" }, { origen: "https://otro.example" })).status === 403,
    "consultor desde otro origen - PATCH -> 403");

  // --- RF-88: consentimiento ---------------------------------------------------------------
  const inicialA = await api(a, "GET", "/api/consultor/perfil");
  ok(inicialA.status === 200 && inicialA.json?.datos?.consentimientoDatos === true && inicialA.json?.datos?.estadoPerfil === "incompleto",
    "RF-88: la cuenta registrada con la casilla ya tiene consentimiento; perfil incompleto (RF-22)");
  const inicialB = await api(b, "GET", "/api/consultor/perfil");
  ok(inicialB.json?.datos?.consentimientoDatos === false, "RF-88: la cuenta sin la casilla no lo tiene");
  const sinCons = await api(b, "PATCH", "/api/consultor/perfil", { nombreProfesional: "B" });
  ok(sinCons.status === 409 && /autorizaci/i.test(sinCons.json?.error ?? ""), `RF-88: guardar sin consentimiento -> 409 (${sinCons.status})`);
  const { error: eConsDirecto } = await b.cliente.from("perfiles").update({ consentimiento_datos_at: new Date().toISOString() }).eq("id", b.id);
  ok(Boolean(eConsDirecto), "RF-88: escribir la fecha directamente en la tabla -> rechazado");
  ok((await api(b, "POST", "/api/consultor/perfil/consentimiento")).status === 200, "RF-88: aceptar desde el editor -> 200");
  ok((await api(b, "PATCH", "/api/consultor/perfil", { nombreProfesional: "B" })).status === 200, "RF-88: después ya guarda");

  // --- Validaciones de forma -----------------------------------------------------------------
  for (const [cuerpo, nombre, patron] of [
    [{ nombreProfesional: "  " }, "nombre vacío", /nombre/i],
    [{ nombreProfesional: "x".repeat(121) }, "nombre de 121 caracteres", /120/],
    [{ nombreProfesional: "x", sitioWeb: "miweb.co" }, "sitio web sin https", /sitio web/i],
    [{ nombreProfesional: "x", redes: [{ tipo: "linkedin", url: "linkedin/yo" }] }, "red con enlace inválido", /enlace/i],
    [{ nombreProfesional: "x", redes: [{ tipo: "tiktok", url: "https://tiktok.com/@yo" }] }, "tipo de red inexistente", /red/i],
    [{ nombreProfesional: "x", especialidades: [crypto.randomUUID()] }, "especialidad inexistente", /especialidad/i],
    [{ nombreProfesional: "x", especialidades: ["no-uuid"] }, "especialidad que no es uuid", /especialidades/i],
    [{ nombreProfesional: "x", portafolio: [{ nombreProyecto: " " }] }, "proyecto de portafolio sin nombre", /nombre del proyecto 1/i],
    [{ nombreProfesional: "x", portafolio: [{ nombreProyecto: "P", anio: 1900 }] }, "año fuera de rango", /año/i],
  ]) {
    const r = await api(a, "PATCH", "/api/consultor/perfil", cuerpo);
    ok(r.status === 400 && patron.test(r.json?.error ?? ""), `${nombre} -> 400 (${r.status}: ${r.json?.error})`);
  }

  // --- RF-23: guardar ---------------------------------------------------------------------------
  const guardado = await api(a, "PATCH", "/api/consultor/perfil", {
    nombreProfesional: `  Consultora A ${sufijo} `, descripcion: "Formulo proyectos de innovación", sitioWeb: "https://consultora.co",
    especialidades: [cat1.id, cat1.id],
    redes: [{ tipo: "linkedin", url: "https://linkedin.com/in/a" }, { tipo: "otra", url: "  " }],
    portafolio: [{ nombreProyecto: "Riego", entidad: "MinCiencias", anio: 2024, resultado: "Aprobado" }, { nombreProyecto: "Agro 4.0" }],
    estadoPerfil: "aprobado", ratingPromedio: 5,
  });
  const pA = guardado.json?.datos;
  ok(guardado.status === 200 && pA?.nombreProfesional === `Consultora A ${sufijo}` && pA?.sitioWeb === "https://consultora.co",
    `guarda datos recortados y el sitio web (${guardado.status})`);
  ok(pA?.especialidades?.length === 1 && pA?.redes?.length === 1 && pA?.portafolio?.length === 2 && pA?.portafolio?.[0]?.anio === 2024,
    "una especialidad sin duplicar, la red vacía se descarta, portafolio en orden");
  ok(pA?.estadoPerfil === "incompleto", "el cuerpo no cambia el estado del perfil");
  const { data: filaA } = await svc.from("consultor_perfiles").select("rating_promedio").eq("id", a.id).single();
  ok(Number(filaA.rating_promedio) === 0, "ni las métricas");

  // --- CU-17: enviar sin archivos ----------------------------------------------------------------
  const sinArchivos = await api(a, "POST", "/api/consultor/perfil/enviar-revision");
  ok(sinArchivos.status === 409 && /la foto/.test(sinArchivos.json?.error ?? "") && /hoja de vida/.test(sinArchivos.json?.error ?? ""),
    `enviar sin foto ni hoja de vida -> 409 con lo que falta (${sinArchivos.json?.error})`);

  // --- Archivos --------------------------------------------------------------------------------
  const gif = await api(a, "POST", "/api/consultor/perfil/archivos/subida", { tipo: "foto", nombreArchivo: "yo.gif", tamanoBytes: 100 });
  ok(gif.status === 400 && /JPG o PNG/.test(gif.json?.error ?? ""), "foto .gif -> 400");
  const grande = await api(a, "POST", "/api/consultor/perfil/archivos/subida", { tipo: "foto", nombreArchivo: "yo.png", tamanoBytes: 6 * 1024 * 1024 });
  ok(grande.status === 400 && /5 MB/.test(grande.json?.error ?? ""), "foto de 6 MB -> 400");
  const cvWord = await api(a, "POST", "/api/consultor/perfil/archivos/subida", { tipo: "cv", nombreArchivo: "cv.docx", tamanoBytes: 100 });
  ok(cvWord.status === 400 && /PDF/.test(cvWord.json?.error ?? ""), "hoja de vida .docx -> 400");

  // El bucket rechaza por su cuenta un tipo que no le corresponde (docs/05 §9.14).
  const trampa = await subir(a, "cv", "cv.pdf", PDF, "text/html");
  ok(Boolean(trampa.eSubida), "subir a la URL firmada con otro tipo de contenido -> lo rechaza Storage");

  const noSubido = await api(a, "POST", "/api/consultor/perfil/archivos", { tipo: "foto", ruta: `${a.id}/foto-${crypto.randomUUID()}.png` });
  ok(noSubido.status === 400 && /no llegó/.test(noSubido.json?.error ?? ""), "registrar un archivo que no existe -> 400");
  const ajena = await api(a, "POST", "/api/consultor/perfil/archivos", { tipo: "cv", ruta: `${b.id}/hoja-de-vida-${crypto.randomUUID()}.pdf` });
  ok(ajena.status === 400, "registrar una ruta de la carpeta de otro -> 400");

  const foto1 = await subir(a, "foto", "Mi foto.PNG", PNG, "image/png");
  ok(foto1.registro?.status === 200 && Boolean(foto1.registro.json?.datos?.fotoUrl), `subir la foto -> 200 con URL firmada (${foto1.registro?.status})`);
  const foto2 = await subir(a, "foto", "otra.jpg", PNG, "image/jpeg");
  const { data: enCarpeta } = await svc.storage.from("fotos-consultores").list(a.id);
  ok(foto2.registro?.status === 200 && enCarpeta?.length === 1 && enCarpeta[0].name === foto2.ruta.split("/")[1],
    `reemplazar la foto borra la anterior (${enCarpeta?.length} en la carpeta)`);

  const cv = await subir(a, "cv", "Hoja de vida.pdf", PDF, "application/pdf");
  ok(cv.registro?.status === 200 && cv.registro.json?.datos?.tieneHojaDeVida === true, "subir la hoja de vida -> 200");
  const enlace = await api(a, "GET", "/api/consultor/perfil/archivos/cv");
  const descarga = enlace.json?.datos?.url ? await fetch(enlace.json.datos.url) : null;
  ok(enlace.status === 200 && descarga?.status === 200 && (await descarga.arrayBuffer()).byteLength === PDF.length,
    "RNF-16: la URL firmada descarga el archivo exacto");
  ok((await api(b, "GET", "/api/consultor/perfil/archivos/cv")).status === 404, "otro consultor sin hoja de vida -> 404 (no ve la de A)");

  // RN-12: nadie más llega a la hoja de vida de A.
  const { error: eDirectoB } = await b.cliente.from("consultor_perfiles").update({ cv_path: cv.ruta }).eq("id", b.id);
  ok(Boolean(eDirectoB), "consultor B apuntando su hoja de vida a la de A directamente -> rechazado");
  const { data: firmaEmp } = await emp.cliente.storage.from("hojas-de-vida").createSignedUrl(cv.ruta, 60);
  ok(!firmaEmp?.signedUrl, "la empresa sin solicitud no puede firmar la hoja de vida de A");
  const { error: eLeeCv } = await emp.cliente.from("consultor_perfiles").select("cv_path").eq("id", a.id);
  ok(Boolean(eLeeCv), "la empresa no lee cv_path de la tabla");

  // --- RF-24: enviar a revisión ------------------------------------------------------------------
  const enviado = await api(a, "POST", "/api/consultor/perfil/enviar-revision");
  ok(enviado.status === 200 && enviado.json?.datos?.estadoPerfil === "en_revision", `con los mínimos -> en_revision (${enviado.status})`);
  ok((await api(a, "POST", "/api/consultor/perfil/enviar-revision")).status === 409, "enviar otra vez -> 409");

  // CU-16 1a: en revisión se edita, pero sin vaciar los mínimos.
  const sinEsp = await api(a, "PATCH", "/api/consultor/perfil", { nombreProfesional: "A", descripcion: "x", especialidades: [] });
  ok(sinEsp.status === 409, `en revisión, quitar todas las especialidades -> 409 (${sinEsp.status})`);
  const sinDesc = await api(a, "PATCH", "/api/consultor/perfil", { nombreProfesional: "A", especialidades: [cat1.id] });
  ok(sinDesc.status === 409, `en revisión, vaciar la descripción -> 409 (${sinDesc.status})`);
  const editaRev = await api(a, "PATCH", "/api/consultor/perfil", {
    nombreProfesional: `Consultora A ${sufijo}`, descripcion: "Nueva", especialidades: [cat1.id, cat2.id],
  });
  ok(editaRev.status === 200 && editaRev.json?.datos?.estadoPerfil === "en_revision", "en revisión, editar lo demás -> 200 sin cambiar el estado");

  // RF-25: rechazado reenvía (el rechazo lo hace aquí service_role; la bandeja llega en el paso 1b).
  await svc.from("consultor_perfiles").update({ estado_perfil: "rechazado", motivo_rechazo: "Falta portafolio" }).eq("id", a.id);
  const rechazado = await api(a, "GET", "/api/consultor/perfil");
  ok(rechazado.json?.datos?.motivoRechazo === "Falta portafolio", "RF-25: el consultor ve el motivo del rechazo");
  const reenvio = await api(a, "POST", "/api/consultor/perfil/enviar-revision");
  ok(reenvio.status === 200 && reenvio.json?.datos?.estadoPerfil === "en_revision", "RF-25: reenviar tras el rechazo -> en_revision");

  // --- Pantalla ---------------------------------------------------------------------------------
  const pantalla = await api(a, "GET", "/consultor/perfil");
  ok(pantalla.status === 200 && pantalla.texto.includes(`Consultora A ${sufijo}`) && pantalla.texto.includes("en revisión"),
    "la pantalla del editor muestra el perfil real y su estado");
  const pantallaB = await api(b, "GET", "/consultor/perfil");
  ok(pantallaB.status === 200 && !pantallaB.texto.includes(`Consultora A ${sufijo}`), "el consultor B no ve el perfil de A en su pantalla");
  const registro = await api(null, "GET", "/registro?puerta=consultor");
  ok(/name="consentimiento_datos"[^>]*required|required[^>]*name="consentimiento_datos"/.test(registro.texto),
    "RF-88: el formulario de registro trae la casilla obligatoria");
} catch (e) {
  fallas++;
  console.error("FALLA inesperada:", e);
} finally {
  for (const id of cuentas) {
    for (const bucket of ["fotos-consultores", "hojas-de-vida"]) {
      const { data } = await svc.storage.from(bucket).list(id);
      if (data?.length) await svc.storage.from(bucket).remove(data.map((o) => `${id}/${o.name}`));
    }
    await svc.auth.admin.deleteUser(id);
  }
  if (categorias.length) await svc.from("categorias").delete().in("id", categorias);
  console.log(fallas === 0 ? "\nTODO PASA" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
