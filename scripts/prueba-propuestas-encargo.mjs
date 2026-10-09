// Prueba de la búsqueda y las propuestas en un encargo "buscar convocatoria",
// contra Supabase real (RF-91, RF-92, RF-93, RN-25, RN-33, RNF-30 · CU-18,
// CU-22 · docs/05 §9.25 · Sprint 5).
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-propuestas-encargo.mjs
//
// Crea sus propias cuentas temporales: dos empresas y dos consultores
// aprobados. Todo lo demás pasa por la API y las pantallas. Borra todo al
// terminar.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import crypto from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.PRUEBA_URL ?? "http://localhost:3000";
const BUCKET = "documentos-convocatorias";
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

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], convocatorias = [], categorias = [], objetos = [];
const hoy = new Date(Date.now() - 5 * 3600 * 1000);  // Colombia
const enDias = (n) => new Date(hoy.getTime() + n * 86400000).toISOString().slice(0, 10);

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre, extra = {}) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.propuestas.${sufijo}@example.com`, password: clave, email_confirm: true,
      user_metadata: { rol, nombre, consentimiento_datos: true, ...extra },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    const s = sesion();
    const { error: e } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (e) throw e;
    s.id = data.user.id;
    s.correo = data.user.email;
    return s;
  };
  const e1 = await crearCuenta("empresa", "empresa1", { nombre_empresa: `Empresa Uno ${sufijo}` });
  const e2 = await crearCuenta("empresa", "empresa2", { nombre_empresa: `Empresa Dos ${sufijo}` });
  const consultor = async (letra) => {
    const s = await crearCuenta("consultor", `consultor-${letra}`);
    await svc.from("consultor_perfiles").update({ nombre_profesional: `Consultor ${letra} ${sufijo}`, estado_perfil: "aprobado" }).eq("id", s.id);
    return s;
  };
  const a = await consultor("a");
  const b = await consultor("b");

  const { data: cat } = await svc.from("categorias").insert({ tipo: "sector", nombre: `Sector propuestas ${sufijo}`, activa: true }).select("id").single();
  categorias.push(cat.id);
  const crearConvocatoria = async (nombre, cierre) => {
    const { data, error } = await svc.from("convocatorias").insert({
      nombre, entidad_convocante: "Entidad de prueba", cobertura_nacional: true, fecha_cierre: cierre,
      estado: "publicada", url_postulacion: "https://prueba.gov.co/propuestas",
    }).select("id").single();
    if (error) throw error;
    convocatorias.push(data.id);
    return data.id;
  };
  const cA = await crearConvocatoria(`Convocatoria Alfa ${sufijo}`, enDias(20));
  const cB = await crearConvocatoria(`Convocatoria Beta ${sufijo}`, enDias(30));
  const cV = await crearConvocatoria(`Convocatoria vencida ${sufijo}`, enDias(-1));
  await svc.from("convocatoria_categoria").insert({ convocatoria_id: cA, categoria_id: cat.id });
  await svc.from("requisitos_convocatoria").insert([
    { convocatoria_id: cA, descripcion: "RUT actualizado", tipo: "documento", obligatorio: true, orden: 0 },
    { convocatoria_id: cA, descripcion: "Carta de intención", tipo: "documento", obligatorio: false, orden: 1 },
  ]);
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
  const docId = crypto.randomUUID(), ruta = `${cA}/${docId}.pdf`;
  const { error: eSubida } = await svc.storage.from(BUCKET).upload(ruta, pdf, { contentType: "application/pdf" });
  if (eSubida) throw eSubida;
  objetos.push(ruta);
  await svc.from("documentos_convocatoria").insert({ id: docId, convocatoria_id: cA, tipo_doc: "TDR", nombre: "Términos de referencia", storage_path: ruta, tipo_mime: "application/pdf", tamano_bytes: pdf.length });

  const { data: p1 } = await svc.from("proyectos").insert({ usuario_id: e1.id, nombre: `Proyecto buscar ${sufijo}`, problema: "Sin convocatoria" }).select("id").single();
  await svc.from("proyecto_categoria").insert({ proyecto_id: p1.id, categoria_id: cat.id });

  // --- La solicitud nace pendiente: todavía sin catálogo --------------------------
  const creado = await api(e1, "POST", "/api/encargos", { proyectoId: p1.id, consultorId: a.id, tipoAyuda: "buscar_convocatoria", titulo: `Buscar convocatoria ${sufijo}`, descripcion: "" });
  const enc = creado.json?.datos?.id;
  ok(creado.status === 201 && enc, `la empresa pide a A buscar convocatoria (${creado.status})`);
  const base = `/api/consultor/encargos/${enc}`;

  const anon = await api(null, "GET", `${base}/convocatorias`);
  ok(anon.status === 307 && /\/login/.test(anon.destino ?? ""), `RNF-30: anónimo -> /login (${anon.status})`);
  ok((await api(e1, "GET", `${base}/convocatorias`)).status === 403, "RNF-30: la empresa en la búsqueda del consultor -> 403");
  ok((await api(a, "GET", `${base}/convocatorias`)).status === 404 && (await api(a, "GET", `${base}/sugerencias`)).status === 404,
    "RF-91: pendiente, ni catálogo ni sugerencias -> 404");
  ok((await api(a, "GET", `/consultor/encargos/${enc}/convocatorias`)).status === 404, "RF-91: ni la pantalla de búsqueda -> 404");
  ok((await api(a, "GET", "/api/convocatorias")).status === 403, "RN-33: el catálogo de la empresa sigue cerrado al consultor -> 403");

  // --- RF-91: al aceptar ---------------------------------------------------------------
  ok((await api(a, "POST", `${base}/responder`, { acepta: true })).status === 200, "A acepta");
  const catalogo = await api(a, "GET", `${base}/convocatorias`);
  const ids = (catalogo.json?.datos ?? []).map((c) => c.id);
  ok(catalogo.status === 200 && ids.includes(cA) && ids.includes(cB) && !ids.includes(cV), "RF-91: en curso ve las vigentes, no la vencida");
  const filtrado = await api(a, "GET", `${base}/convocatorias?q=${encodeURIComponent(`alfa ${sufijo}`)}`);
  ok(filtrado.json?.datos?.length === 1 && filtrado.json.datos[0].id === cA, "RF-91, RF-12: con texto libre");
  ok((await api(a, "GET", `${base}/convocatorias?departamento=xx`)).status === 400, "y valida los filtros como el de la empresa -> 400");
  const ficha = await api(a, "GET", `${base}/convocatorias/${cA}`);
  ok(ficha.status === 200 && ficha.json?.datos?.requisitos?.length === 2 && ficha.json?.datos?.documentos?.length === 1, "RF-91: la ficha con requisitos y adjuntos");
  ok((await api(a, "GET", `${base}/convocatorias/${cV}`)).status === 404, "RF-91: la ficha de una vencida -> 404");
  const enlace = await api(a, "GET", `${base}/convocatorias/${cA}/documentos/${docId}/enlace`);
  ok(enlace.status === 200 && /token=/.test(enlace.json?.datos?.url ?? ""), "RF-91, RNF-16: descarga el adjunto por URL firmada");
  const sug = await api(a, "GET", `${base}/sugerencias`);
  const sugA = sug.json?.datos?.sugerencias?.find((s) => s.convocatoria.id === cA);
  ok(sug.status === 200 && sugA?.porcentaje >= 20 && sugA?.criterios?.find((c) => c.clave === "sector")?.estado === "cumple",
    "RF-91, RN-05: las sugerencias del proyecto, A coincide en sector");
  const pantalla = await api(a, "GET", `/consultor/encargos/${enc}/convocatorias`);
  ok(pantalla.status === 200 && pantalla.texto.includes(`Convocatoria Alfa ${sufijo}`) && pantalla.texto.includes(`Proyecto buscar ${sufijo}`),
    "la pantalla de búsqueda muestra el proyecto y las convocatorias");
  const pantallaFicha = await api(a, "GET", `/consultor/encargos/${enc}/convocatorias/${cA}`);
  // El HTML del servidor no trae el formulario (GuardaConsultor espera al store); sí sus datos en la carga RSC.
  ok(pantallaFicha.status === 200 && /admitePropuestas.{0,2}:true/.test(pantallaFicha.texto) && pantallaFicha.texto.includes(`/api/consultor/encargos/${enc}/convocatorias/${cA}/documentos`),
    "la ficha del encargo lleva el formulario de proponer y descarga desde el encargo");

  // --- Otro consultor ------------------------------------------------------------------
  ok((await api(b, "GET", `${base}/convocatorias`)).status === 404 && (await api(b, "GET", `${base}/sugerencias`)).status === 404
    && (await api(b, "GET", `${base}/convocatorias/${cA}/documentos/${docId}/enlace`)).status === 404,
    "RF-91: otro consultor no busca desde el encargo ajeno -> 404");
  ok((await api(b, "POST", `${base}/propuestas`, { convocatoriaId: cA, nota: "Ajena" })).status === 404, "ni propone en él -> 404");

  // --- RF-92: proponer -----------------------------------------------------------------
  ok((await api(a, "POST", `${base}/propuestas`, { convocatoriaId: cA, nota: "x" }, { origen: "https://otro.example" })).status === 403, "proponer desde otro origen -> 403");
  ok((await api(a, "POST", `${base}/propuestas`, { convocatoriaId: cA, nota: "   " })).status === 400, "RF-92: sin nota -> 400");
  ok((await api(a, "POST", `${base}/propuestas`, { convocatoriaId: cA, nota: "x".repeat(1001) })).status === 400, "RF-92: nota de más de 1.000 -> 400");
  ok((await api(a, "POST", `${base}/propuestas`, { convocatoriaId: cV, nota: "Vencida" })).status === 409, "RF-92: una vencida -> 409");
  const pA = await api(a, "POST", `${base}/propuestas`, { convocatoriaId: cA, nota: `Coincide en sector ${sufijo}` });
  ok(pA.status === 201, `RF-92: propone A (${pA.status})`);
  ok((await api(a, "POST", `${base}/propuestas`, { convocatoriaId: cA, nota: "Otra vez" })).status === 409, "RF-92: A otra vez -> 409");
  const pB = await api(a, "POST", `${base}/propuestas`, { convocatoriaId: cB, nota: `Plazo largo ${sufijo}` });
  ok(pB.status === 201, "RF-92: propone B");

  const deEmpresa = await api(e1, "GET", `/api/encargos/${enc}/propuestas`);
  const vistaA = deEmpresa.json?.datos?.find((p) => p.convocatoriaId === cA);
  ok(deEmpresa.status === 200 && deEmpresa.json.datos.length === 2 && vistaA?.porcentaje >= 20 && vistaA?.nota === `Coincide en sector ${sufijo}` && vistaA?.vigente,
    "RF-92: la empresa ve las propuestas con nota y compatibilidad");
  ok((await api(e2, "GET", `/api/encargos/${enc}/propuestas`)).status === 404, "RN-30: otra empresa no las ve -> 404");
  const listaE1 = (await api(e1, "GET", "/api/encargos")).json?.datos?.find((x) => x.id === enc);
  ok(listaE1?.propuestas?.length === 2, "y llegan con el encargo en el listado");
  const pantallaE1 = await api(e1, "GET", "/encargos");
  ok(pantallaE1.texto.includes(`Coincide en sector ${sufijo}`) && pantallaE1.texto.includes("Elegir esta convocatoria"), "la pantalla de la empresa las muestra para elegir");
  const pantallaE2 = await api(e2, "GET", "/encargos");
  ok(!pantallaE2.texto.includes(`Coincide en sector ${sufijo}`), "y la de otra empresa no (Hito 1)");

  // --- RF-92: retirar ------------------------------------------------------------------
  ok((await api(b, "POST", `/api/consultor/propuestas/${pB.json?.datos?.id}/retirar`)).status === 404, "otro consultor no la retira -> 404");
  ok((await api(a, "POST", `/api/consultor/propuestas/${pB.json?.datos?.id}/retirar`)).status === 200, "RF-92: A retira B");
  ok((await api(a, "POST", `/api/consultor/propuestas/${pB.json?.datos?.id}/retirar`)).status === 409, "retirarla otra vez -> 409");

  // --- RF-93: elegir -------------------------------------------------------------------
  const elegirRuta = (encargo, propuesta) => `/api/encargos/${encargo}/propuestas/${propuesta}/elegir`;
  ok((await api(e2, "POST", elegirRuta(enc, pA.json?.datos?.id))).status === 404, "RF-93: otra empresa no elige -> 404");
  ok((await api(a, "POST", elegirRuta(enc, pA.json?.datos?.id))).status === 403, "RNF-30: el consultor no elige -> 403");
  ok((await api(e1, "POST", elegirRuta(crypto.randomUUID(), pA.json?.datos?.id))).status === 404, "RF-93: con otro encargo en la ruta -> 404");
  ok((await api(e1, "POST", elegirRuta(enc, pB.json?.datos?.id))).status === 409, "RF-93: no elige una retirada -> 409");
  const elige = await api(e1, "POST", elegirRuta(enc, pA.json?.datos?.id));
  ok(elige.status === 200 && elige.json?.datos?.convocatoriaId === cA, `RF-93: la empresa elige A (${elige.status})`);
  ok((await api(e1, "POST", elegirRuta(enc, pA.json?.datos?.id))).status === 409, "RF-93 6b: elegir otra vez -> 409");
  const trasElegir = (await api(e1, "GET", "/api/encargos")).json?.datos?.find((x) => x.id === enc);
  ok(trasElegir?.estado === "en_curso" && trasElegir?.convocatoriaId === cA && trasElegir?.convocatoriaNombre === `Convocatoria Alfa ${sufijo}`,
    "RF-93: el encargo sigue en curso con A como su convocatoria");
  ok((await api(a, "POST", `${base}/propuestas`, { convocatoriaId: cB, nota: "Tarde" })).status === 409, "RF-93 (d): con una elegida no se proponen más -> 409");
  ok((await api(a, "GET", `${base}/convocatorias`)).status === 200, "RF-93 (d): la búsqueda sigue abierta");
  const pantallaElegida = await api(e1, "GET", "/encargos");
  ok(pantallaElegida.texto.includes("Postular con este proyecto"), "la empresa ve el botón de postular");

  // --- CU-22 paso 7: postular vincula ----------------------------------------------------
  const post = await api(e1, "POST", "/api/postulaciones", { convocatoriaId: cA, proyectoId: p1.id });
  ok(post.status === 201, `la empresa postula con el proyecto (${post.status})`);
  const vinculado = (await api(e1, "GET", "/api/encargos")).json?.datos?.find((x) => x.id === enc);
  ok(vinculado?.postulacionId === post.json?.datos?.id, "CU-22 paso 7: la postulación queda vinculada al encargo");
  const ctx = (await api(a, "GET", "/api/consultor/encargos")).json?.datos?.find((x) => x.id === enc)?.contexto;
  ok(ctx?.convocatoria?.id === cA && ctx?.convocatoria?.requisitos?.length === 2 && ctx?.checklist?.length === 2,
    "RN-25: el consultor ve la convocatoria elegida, sus requisitos y el checklist");

  // --- Al terminar ---------------------------------------------------------------------
  ok((await api(a, "POST", `${base}/completar`)).status === 200, "A completa el encargo");
  ok((await api(a, "GET", `${base}/convocatorias`)).status === 404 && (await api(a, "GET", `/consultor/encargos/${enc}/convocatorias`)).status === 404,
    "RF-91: completado, pierde el catálogo y la pantalla -> 404");
  const historial = (await api(e1, "GET", `/api/encargos/${enc}/propuestas`)).json?.datos ?? [];
  ok(historial.map((p) => p.estado).sort().join(",") === "elegida,retirada", "las propuestas quedan como historial");
} catch (e) {
  fallas++;
  console.error("FALLA inesperada:", e);
} finally {
  if (cuentas.length) {
    await svc.from("encargos").delete().in("empresa_id", cuentas);
    await svc.from("postulaciones").delete().in("usuario_id", cuentas);
    await svc.from("proyectos").delete().in("usuario_id", cuentas);
  }
  if (objetos.length) await svc.storage.from(BUCKET).remove(objetos);
  // Las hijas (adjuntos, requisitos, categorías) caen en cascada; las propuestas ya cayeron con los encargos.
  if (convocatorias.length) await svc.from("convocatorias").delete().in("id", convocatorias);
  for (const id of [...cuentas].reverse()) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (categorias.length) await svc.from("categorias").delete().in("id", categorias);
  console.log(fallas === 0 ? "\nTODO PASA" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
