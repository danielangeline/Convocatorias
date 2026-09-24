// Prueba del catálogo de la empresa contra Supabase real (RF-11, RF-12, RF-13,
// RF-43, RF-44, CU-07, CU-08, RN-02, RN-33, RNF-16, RNF-30 · Sprint 2 pasos 4 y 5).
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-catalogo-empresa.mjs
//
// Crea sus propias cuentas temporales (una empresa y un consultor) y, con
// service_role, una fuente, dos categorías y cinco convocatorias —publicada y
// vigente con un adjunto real, borrador, publicada pero vencida, cerrada y
// despublicada—. Borra todo
// al terminar, incluidos los objetos del bucket.
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
async function pedir(s, ruta) {
  const r = await fetch(APP + ruta, { headers: s ? { cookie: s.cookie() } : {}, redirect: "manual" });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* HTML */ }
  return { status: r.status, json, texto, destino: r.headers.get("location") };
}

const sufijo = crypto.randomBytes(3).toString("hex");
const hoy = new Date();
const enDias = (n) => new Date(hoy.getTime() + n * 86400000).toISOString().slice(0, 10);
const cuentas = [], convocatorias = [], categorias = [], fuentes = [];

try {
  // --- Cuentas temporales -------------------------------------------------------
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${rol}.catalogo.${sufijo}@example.com`, password: clave, email_confirm: true,
      user_metadata: { rol, nombre: `${rol} catálogo` },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    const s = sesion();
    const { error: e } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (e) throw e;
    return s;
  };
  const emp = await crearCuenta("empresa");
  const con = await crearCuenta("consultor");

  // --- RF-44: indicadores ----------------------------------------------------------------
  // Antes de crear contenido: la respuesta queda en caché una hora, y no debe
  // incluir las convocatorias temporales de esta prueba.
  const ind = await pedir(null, "/api/indicadores");
  const d = ind.json?.datos;
  ok(ind.status === 200 && [d?.convocatoriasVigentes, d?.montoDisponible, d?.entidades, d?.consultoresAprobados].every((n) => Number.isFinite(n)),
    `visitante - /api/indicadores -> cuatro cifras (${JSON.stringify(d)})`);
  ok(ind.json && Object.keys(ind.json.datos ?? {}).length === 4, "los indicadores traen solo las cuatro cifras");
  const portada = await pedir(null, "/");
  ok(portada.status === 200 && portada.texto.includes("Convocatorias vigentes"), "portada - muestra los indicadores");

  // --- Contenido con service_role -------------------------------------------------
  const { data: fuente } = await svc.from("fuentes").insert({ nombre: `Fuente catálogo ${sufijo}`, activa: true }).select("id").single();
  fuentes.push(fuente.id);
  const { data: sector } = await svc.from("categorias").insert({ tipo: "sector", nombre: `Agroindustria ${sufijo}`, activa: true }).select("id").single();
  const { data: tipoP } = await svc.from("categorias").insert({ tipo: "tipo_proyecto", nombre: `Innovación ${sufijo}`, activa: true }).select("id").single();
  categorias.push(sector.id, tipoP.id);

  const crearConvocatoria = async (nombre, estado, cierre, extra = {}) => {
    const { data, error } = await svc.from("convocatorias").insert({
      fuente_id: fuente.id, nombre, entidad_convocante: `Entidad ${sufijo}`, descripcion: "Apoyo a la innovación agroindustrial",
      ubicacion_cobertura: "Antioquia", fecha_cierre: cierre, url_postulacion: "https://entidad.gov.co/x", estado, ...extra,
    }).select("id").single();
    if (error) throw error;
    convocatorias.push(data.id);
    // RN-34 · cobertura por departamento: Antioquia (05).
    const { error: eDep } = await svc.from("convocatoria_departamento").insert({ convocatoria_id: data.id, departamento_codigo: "05" });
    if (eDep) throw eDep;
    return data.id;
  };
  const pub = await crearConvocatoria(`Convocatoria pública ${sufijo}`, "publicada", enDias(20), { monto_min: 50000000, monto_max: 300000000 });
  const bor = await crearConvocatoria(`Convocatoria borrador ${sufijo}`, "borrador", enDias(20));
  const ven = await crearConvocatoria(`Convocatoria vencida ${sufijo}`, "publicada", enDias(-3));
  const cer = await crearConvocatoria(`Convocatoria cerrada ${sufijo}`, "cerrada", enDias(-40));
  const desp = await crearConvocatoria(`Convocatoria despublicada ${sufijo}`, "despublicada", enDias(20));
  await svc.from("convocatoria_categoria").insert([{ convocatoria_id: pub, categoria_id: sector.id }, { convocatoria_id: pub, categoria_id: tipoP.id }]);
  await svc.from("requisitos_convocatoria").insert([
    { convocatoria_id: pub, descripcion: "Cámara de comercio", tipo: "documento", obligatorio: true, orden: 1 },
    { convocatoria_id: pub, descripcion: "Ser pyme", tipo: "condicion", obligatorio: false, orden: 2 },
  ]);
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
  const adjuntar = async (convId) => {
    const id = crypto.randomUUID(), ruta = `${convId}/${id}.pdf`;
    const { error } = await svc.storage.from(BUCKET).upload(ruta, pdf, { contentType: "application/pdf" });
    if (error) throw error;
    await svc.from("documentos_convocatoria").insert({ id, convocatoria_id: convId, tipo_doc: "TDR", nombre: "Términos de referencia", storage_path: ruta, tipo_mime: "application/pdf", tamano_bytes: pdf.length });
    return { id, ruta };
  };
  const docPub = await adjuntar(pub);
  const docBor = await adjuntar(bor);

  // --- RN-33: quién ve el catálogo ------------------------------------------------
  const anonLista = await pedir(null, "/api/convocatorias");
  ok(anonLista.status === 307 && /\/login/.test(anonLista.destino ?? ""), `visitante - GET /api/convocatorias -> redirige a /login (${anonLista.status})`);
  ok((await pedir(con, "/api/convocatorias")).status === 403, "consultor - GET /api/convocatorias -> 403");
  ok((await pedir(con, `/api/convocatorias/${pub}`)).status === 403, "consultor - ficha -> 403");
  ok((await pedir(con, `/api/convocatorias/${pub}/documentos/${docPub.id}/enlace`)).status === 403, "consultor - descarga -> 403");

  const { data: directaCon } = await con.cliente.from("convocatorias").select("id").in("id", [pub, bor, ven]);
  ok((directaCon ?? []).length === 0, `consultor leyendo la tabla directamente -> 0 filas (${directaCon?.length})`);
  const { data: firmaCon } = await con.cliente.storage.from(BUCKET).createSignedUrl(docPub.ruta, 60);
  ok(!firmaCon?.signedUrl, "consultor firmando el adjunto directamente en Storage -> rechazado");

  // --- Empresa: listado --------------------------------------------------------------
  const lista = await pedir(emp, "/api/convocatorias");
  const ids = (lista.json?.datos ?? []).map((c) => c.id);
  ok(lista.status === 200 && ids.includes(pub), `empresa - la publicada y vigente aparece (${lista.status})`);
  ok(!ids.includes(bor), "empresa - el borrador no aparece");
  ok(!ids.includes(ven), "empresa - la publicada vencida no aparece (RN-02)");
  const laPub = (lista.json?.datos ?? []).find((c) => c.id === pub);
  ok(laPub?.montoMin === 50000000 && laPub?.montoMax === 300000000 && laPub?.categorias?.length === 2,
    "empresa - trae montos y categorías reales");

  ok(!ids.includes(cer) && !ids.includes(desp), "empresa - ni la cerrada ni la despublicada aparecen por defecto (RN-02)");

  // --- RF-11, RN-02: cerradas solo bajo filtro explícito --------------------------------
  const conCerradas = await pedir(emp, "/api/convocatorias?incluirCerradas=true");
  const lc = conCerradas.json?.datos ?? [];
  const pos = (id) => lc.findIndex((c) => c.id === id);
  ok(conCerradas.status === 200 && pos(cer) >= 0 && pos(ven) >= 0, "incluirCerradas - aparecen la cerrada y la publicada vencida");
  ok(lc.find((c) => c.id === ven)?.estado === "cerrada" && lc.find((c) => c.id === cer)?.estado === "cerrada",
    "incluirCerradas - las dos vienen marcadas como cerradas");
  ok(pos(pub) >= 0 && pos(pub) < pos(ven) && pos(ven) < pos(cer), "incluirCerradas - vigentes primero; cerradas de la más reciente a la más antigua");
  ok(pos(bor) === -1 && pos(desp) === -1, "incluirCerradas - borrador y despublicada siguen sin aparecer (RN-33)");
  const qCerradas = (await pedir(emp, `/api/convocatorias?incluirCerradas=true&q=${encodeURIComponent("cerrada " + sufijo)}`)).json?.datos ?? [];
  ok(qCerradas.length === 1 && qCerradas[0].id === cer, "los filtros también se aplican a las cerradas");
  ok((await pedir(con, "/api/convocatorias?incluirCerradas=true")).status === 403, "consultor - incluirCerradas -> 403");
  const fichaCer = await pedir(emp, `/api/convocatorias/${cer}`);
  ok(fichaCer.status === 200 && fichaCer.json.datos.estado === "cerrada", "empresa - la ficha de una cerrada se abre, marcada como cerrada");
  ok((await pedir(emp, `/api/convocatorias/${desp}`)).status === 404, "empresa - la ficha de una despublicada -> 404");
  const { error: ePost } = await emp.cliente.from("postulaciones").insert({ convocatoria_id: cer });
  ok(Boolean(ePost), `empresa - postular a una cerrada directamente en la base -> rechazado (RF-78) (${ePost?.code ?? "sin error"})`);

  // --- RF-12: filtros -----------------------------------------------------------------
  const incluye = async (qs) => ((await pedir(emp, `/api/convocatorias?${qs}`)).json?.datos ?? []).some((c) => c.id === pub);
  ok(await incluye(`q=${encodeURIComponent("innovacion agroindustrial")}`), "búsqueda sin tildes encuentra \"innovación agroindustrial\"");
  ok(!(await incluye("q=inexistentexyz")), "búsqueda sin coincidencias la excluye");
  ok(await incluye(`sector=${sector.id}`), "filtro por sector la incluye");
  ok(await incluye(`tipoProyecto=${tipoP.id}&sector=${sector.id}`), "tipo de proyecto + sector combinados la incluyen");
  ok(!(await incluye(`sector=${crypto.randomUUID()}`)), "filtro por otro sector la excluye");
  ok(await incluye(`montoHasta=${encodeURIComponent("50.000.000")}`), "monto mínimo hasta 50.000.000 la incluye");
  ok(!(await incluye(`montoHasta=${encodeURIComponent("49.999.999")}`)), "monto mínimo hasta 49.999.999 la excluye");
  ok((await pedir(emp, "/api/convocatorias?montoHasta=1.5")).status === 400, "monto ambiguo en el filtro -> 400");
  ok(await incluye(`departamento=05`), "filtro por su departamento (Antioquia, 05) la incluye (RN-34)");
  ok(!(await incluye(`departamento=08`)), "filtro por otro departamento (Atlántico, 08) la excluye");
  ok((await pedir(emp, "/api/convocatorias?departamento=antioquia")).status === 400, "departamento que no es código DANE -> 400");
  ok(await incluye(`cierraAntesDe=${enDias(20)}`) && !(await incluye(`cierraAntesDe=${enDias(19)}`)), "cierre antes de una fecha, en el límite exacto");

  // --- RF-13, CU-08: ficha y descarga -------------------------------------------------
  const ficha = await pedir(emp, `/api/convocatorias/${pub}`);
  ok(ficha.status === 200 && ficha.json.datos.requisitos.length === 2 && ficha.json.datos.documentos.length === 1
    && ficha.json.datos.urlPostulacion === "https://entidad.gov.co/x", "empresa - ficha con requisitos, documento y enlace oficial");
  ok((await pedir(emp, `/api/convocatorias/${bor}`)).status === 404, "empresa - ficha del borrador -> 404");
  ok((await pedir(emp, `/api/convocatorias/no-es-uuid`)).status === 404, "empresa - id que no es uuid -> 404");

  const enlace = await pedir(emp, `/api/convocatorias/${pub}/documentos/${docPub.id}/enlace`);
  ok(enlace.status === 200 && /token=/.test(enlace.json?.datos?.url ?? ""), "empresa - enlace firmado del adjunto");
  if (enlace.json?.datos?.url) {
    const archivo = await fetch(enlace.json.datos.url);
    const cuerpo = Buffer.from(await archivo.arrayBuffer());
    ok(archivo.status === 200 && cuerpo.equals(pdf), "el enlace descarga el PDF exacto");
    const nombre = new URL(enlace.json.datos.url).searchParams.get("download");
    ok(nombre === "Términos de referencia.pdf" && /^attachment/.test(archivo.headers.get("content-disposition") ?? ""),
      `se descarga como adjunto con el nombre descriptivo (${nombre})`);
  }
  ok((await pedir(emp, `/api/convocatorias/${bor}/documentos/${docBor.id}/enlace`)).status === 404, "empresa - adjunto del borrador -> 404");
  const { data: firmaEmpBor } = await emp.cliente.storage.from(BUCKET).createSignedUrl(docBor.ruta, 60);
  ok(!firmaEmpBor?.signedUrl, "empresa firmando el adjunto del borrador directamente en Storage -> rechazado");

  // --- Pantallas ------------------------------------------------------------------------
  const pagina = await pedir(emp, "/convocatorias");
  ok(pagina.status === 200 && pagina.texto.includes(`Convocatoria pública ${sufijo}`) && !pagina.texto.includes(`Convocatoria borrador ${sufijo}`),
    "empresa - /convocatorias muestra la real y no el borrador");
  ok(!pagina.texto.includes("Bogotá Reactiva"), "empresa - /convocatorias ya no muestra datos de ejemplo");
  // Los datos de la cerrada viajan a la pantalla (la empresa puede leerla, para el
  // filtro); lo que no debe haber es su tarjeta pintada.
  ok(new RegExp(`<h3[^>]*>Convocatoria pública ${sufijo}</h3>`).test(pagina.texto)
    && !new RegExp(`<h3[^>]*>Convocatoria cerrada ${sufijo}</h3>`).test(pagina.texto),
    "empresa - /convocatorias pinta la vigente y no la cerrada sin el filtro");
  const paginaCer = await pedir(emp, `/convocatorias/${cer}`);
  ok(paginaCer.status === 200 && paginaCer.texto.includes("ya cerró") && !paginaCer.texto.includes("Ir al portal de la entidad"),
    "empresa - la ficha de una cerrada avisa que cerró y no ofrece ir al portal");
  const paginaFicha = await pedir(emp, `/convocatorias/${pub}`);
  ok(paginaFicha.status === 200 && paginaFicha.texto.includes("Cámara de comercio"), "empresa - /convocatorias/[id] muestra los requisitos reales");

  const portadaFinal = await pedir(null, "/");
  ok(!portadaFinal.texto.includes(`Convocatoria pública ${sufijo}`), "portada - ninguna convocatoria individual a la vista (RN-33)");
} finally {
  for (const id of convocatorias) {
    const { data: objetos } = await svc.storage.from(BUCKET).list(id);
    if (objetos?.length) await svc.storage.from(BUCKET).remove(objetos.map((o) => `${id}/${o.name}`));
  }
  if (convocatorias.length) await svc.from("convocatorias").delete().in("id", convocatorias);
  if (categorias.length) await svc.from("categorias").delete().in("id", categorias);
  if (fuentes.length) await svc.from("fuentes").delete().in("id", fuentes);
  for (const id of cuentas) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  console.log("datos y cuentas de prueba borrados");
}
console.log(fallas ? `${fallas} FALLAS` : "TODO PASÓ");
process.exitCode = fallas ? 1 : 0;
