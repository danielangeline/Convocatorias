// Prueba de los proyectos de la empresa contra Supabase real (RF-14, RF-45,
// RF-46, RF-81, CU-09, RN-30, RNF-30 · docs/05 §9.17 · Sprint 3 paso 1).
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-proyectos.mjs
//
// Crea sus propias cuentas temporales (dos empresas y un consultor) y, con
// service_role, dos categorías, una convocatoria vigente, un encargo y un
// documento generado. Borra todo al terminar.
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

const sufijo = crypto.randomBytes(3).toString("hex");
const hoyCO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const enDias = (n) => new Date(Date.parse(hoyCO) + n * 86400000).toISOString().slice(0, 10);
const cuentas = [], categorias = [], convocatorias = [];

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.proyectos.${sufijo}@example.com`, password: clave, email_confirm: true, user_metadata: { rol, nombre },
    });
    if (error) throw error;
    cuentas.push(data.user.id);
    const s = sesion();
    const { error: e } = await s.cliente.auth.signInWithPassword({ email: data.user.email, password: clave });
    if (e) throw e;
    s.id = data.user.id;
    return s;
  };
  const a = await crearCuenta("empresa", "empresa-a");
  const b = await crearCuenta("empresa", "empresa-b");
  const con = await crearCuenta("consultor", "consultor");

  const { data: catActiva } = await svc.from("categorias").insert({ tipo: "sector", nombre: `Agro proyectos ${sufijo}`, activa: true }).select("id").single();
  const { data: catOtra } = await svc.from("categorias").insert({ tipo: "tipo_proyecto", nombre: `Innovación proyectos ${sufijo}`, activa: true }).select("id").single();
  const { data: catInactiva } = await svc.from("categorias").insert({ tipo: "sector", nombre: `Inactiva proyectos ${sufijo}`, activa: false }).select("id").single();
  categorias.push(catActiva.id, catOtra.id, catInactiva.id);

  // --- RNF-30: quién llega a los endpoints --------------------------------------------
  const anon = await api(null, "GET", "/api/proyectos");
  ok(anon.status === 307 && /\/login/.test(anon.destino ?? ""), `visitante - GET /api/proyectos -> /login (${anon.status})`);
  ok((await api(con, "GET", "/api/proyectos")).status === 403, "consultor - GET /api/proyectos -> 403");
  ok((await api(con, "POST", "/api/proyectos", { nombre: "x" })).status === 403, "consultor - POST /api/proyectos -> 403");
  ok((await api(a, "POST", "/api/proyectos", { nombre: "x" }, { origen: "https://otro.example" })).status === 403, "empresa desde otro origen - POST -> 403");

  // --- RF-14, RF-45: crear ---------------------------------------------------------------
  const minimo = await api(a, "POST", "/api/proyectos", { nombre: `  Mínimo ${sufijo}  ` });
  const pMin = minimo.json?.datos;
  ok(minimo.status === 200 && pMin?.nombre === `Mínimo ${sufijo}` && pMin?.completitud === 0 && pMin?.montoBuscado === null && pMin?.usuarioId === a.id,
    `crear con solo el nombre -> 200, recortado, completitud 0, sin monto, dueño = la sesión (${minimo.status})`);

  const completo = await api(a, "POST", "/api/proyectos", {
    nombre: `Completo ${sufijo}`, descripcion: "Riego inteligente", montoBuscado: "150.000.000", ubicacion: "Antioquia",
    categorias: [catActiva.id, catOtra.id], problema: "Sequía", objetivoGeneral: "Reducir pérdidas",
    objetivosEspecificos: ["Instalar sensores", "  ", "Capacitar productores"], poblacionBeneficiaria: "Productores",
    actividades: "Diagnóstico e instalación", resultadosEsperados: "30% menos pérdidas", duracionMeses: 12,
    presupuestoEstimado: "$ 200.000.000", experienciaEmpresa: "10 años", usuarioId: b.id, completitud: 3,
  });
  const pComp = completo.json?.datos;
  ok(completo.status === 200 && pComp?.completitud === 100, `todos los campos de contenido -> completitud 100 (${completo.status}, ${pComp?.completitud})`);
  ok(pComp?.montoBuscado === 150000000 && pComp?.presupuestoEstimado === 200000000, "montos en formato colombiano -> 150000000 y 200000000");
  ok(pComp?.objetivosEspecificos?.length === 2 && pComp?.categorias?.length === 2, "objetivos sin los vacíos y dos categorías");
  ok(pComp?.usuarioId === a.id, "el dueño es la sesión aunque el cuerpo diga otro (RN-30)");

  const parcial = await api(a, "POST", "/api/proyectos", {
    nombre: `Parcial ${sufijo}`, problema: "Algo", objetivoGeneral: "Algo más", duracionMeses: 6, presupuestoEstimado: "1.000",
  });
  ok(parcial.json?.datos?.completitud === 44, `4 de 9 campos -> completitud 44 (${parcial.json?.datos?.completitud})`);

  // --- Validaciones de forma ---------------------------------------------------------------
  for (const [cuerpo, nombre, patron] of [
    [{ nombre: "   " }, "nombre en blanco", /nombre/i],
    [{ nombre: "x".repeat(201) }, "nombre de 201 caracteres", /200/],
    [{ nombre: "x", montoBuscado: "1.5" }, "monto ambiguo", /monto buscado/i],
    [{ nombre: "x", presupuestoEstimado: "1.000,50" }, "presupuesto con centavos", /presupuesto/i],
    [{ nombre: "x", duracionMeses: 0 }, "duración 0", /duración/i],
    [{ nombre: "x", duracionMeses: 2.5 }, "duración decimal", /duración/i],
    [{ nombre: "x", categorias: [catInactiva.id] }, "categoría inactiva", /categor/i],
    [{ nombre: "x", categorias: [crypto.randomUUID()] }, "categoría inexistente", /categor/i],
    [{ nombre: "x", categorias: ["no-es-uuid"] }, "categoría que no es uuid", /categor/i],
    [{ nombre: "x", objetivosEspecificos: "uno" }, "objetivos que no son lista", /objetivos/i],
  ]) {
    const r = await api(a, "POST", "/api/proyectos", cuerpo);
    ok(r.status === 400 && patron.test(r.json?.error ?? ""), `${nombre} -> 400 (${r.status}: ${r.json?.error})`);
  }

  // --- RF-81: editar ----------------------------------------------------------------------------
  const edit = await api(a, "PATCH", `/api/proyectos/${pComp.id}`, {
    nombre: `Completo editado ${sufijo}`, categorias: [catOtra.id], problema: "Sequía", montoBuscado: "",
  });
  const pEd = edit.json?.datos;
  ok(edit.status === 200 && pEd?.nombre === `Completo editado ${sufijo}` && pEd?.categorias?.length === 1 && pEd?.categorias[0] === catOtra.id,
    "editar reemplaza datos y categorías");
  ok(pEd?.completitud === 11 && pEd?.montoBuscado === null, `al vaciar campos la completitud baja a 11 y el monto queda sin definir (${pEd?.completitud})`);

  // La categoría que ya tenía se conserva aunque se desactive después.
  await svc.from("categorias").update({ activa: false }).eq("id", catOtra.id);
  const conserva = await api(a, "PATCH", `/api/proyectos/${pComp.id}`, { nombre: `Completo editado ${sufijo}`, categorias: [catOtra.id] });
  ok(conserva.status === 200, `una categoría ya asignada se conserva aunque se desactive (${conserva.status})`);
  await svc.from("categorias").update({ activa: true }).eq("id", catOtra.id);

  // --- RN-30: la otra empresa no ve nada -------------------------------------------------------
  const listaB = await api(b, "GET", "/api/proyectos");
  ok(listaB.status === 200 && (listaB.json?.datos ?? []).length === 0, "empresa B - su lista no trae los proyectos de A");
  ok((await api(b, "GET", `/api/proyectos/${pComp.id}`)).status === 404, "empresa B - ficha de un proyecto de A -> 404");
  ok((await api(b, "PATCH", `/api/proyectos/${pComp.id}`, { nombre: "robado" })).status === 404, "empresa B - editar un proyecto de A -> 404");
  ok((await api(b, "DELETE", `/api/proyectos/${pComp.id}`)).status === 404, "empresa B - borrar un proyecto de A -> 404");
  const { data: directoB } = await b.cliente.from("proyectos").select("id").eq("id", pComp.id);
  ok((directoB ?? []).length === 0, "empresa B leyendo la tabla directamente -> 0 filas");
  const { error: ePcB } = await b.cliente.from("proyecto_categoria").insert({ proyecto_id: pComp.id, categoria_id: catActiva.id });
  ok(Boolean(ePcB), "empresa B añadiendo una categoría al proyecto de A directamente -> rechazado");
  const listaA = await api(a, "GET", "/api/proyectos");
  ok((listaA.json?.datos ?? []).length === 3, `empresa A - ve sus 3 proyectos (${(listaA.json?.datos ?? []).length})`);

  // --- RF-46: la completitud no se puede falsear ---------------------------------------------
  await a.cliente.from("proyectos").update({ completitud: 99 }).eq("id", pMin.id);
  const { data: falseado } = await svc.from("proyectos").select("completitud").eq("id", pMin.id).single();
  ok(falseado.completitud === 0, `escribir completitud = 99 directamente la deja en su valor calculado (${falseado.completitud})`);

  // --- CU-09 2a: borrar -----------------------------------------------------------------------
  const cons0 = await api(a, "GET", `/api/proyectos/${pMin.id}?consecuencias=1`);
  ok(cons0.status === 200 && cons0.json?.datos?.documentos === 0 && cons0.json?.datos?.encargos === 0, "consecuencias de un proyecto sin nada -> 0 y 0");

  // Documento generado sobre el proyecto parcial: al borrarlo, se va en cascada.
  const { data: conv } = await svc.from("convocatorias").insert({
    nombre: `Conv proyectos ${sufijo}`, entidad_convocante: "Prueba", fecha_cierre: enDias(10), estado: "publicada", url_postulacion: "https://prueba.gov.co/p",
  }).select("id").single();
  convocatorias.push(conv.id);
  const pPar = parcial.json.datos;
  const { error: eDoc } = await svc.from("documentos_generados").insert({ usuario_id: a.id, proyecto_id: pPar.id, convocatoria_id: conv.id, titulo: "Doc", contenido: {} });
  ok(!eDoc, `documento generado de prueba creado ${eDoc?.message ?? ""}`);
  const cons1 = await api(a, "GET", `/api/proyectos/${pPar.id}?consecuencias=1`);
  ok(cons1.json?.datos?.documentos === 1, "consecuencias -> 1 documento generado");

  // Encargo sobre el proyecto completo: no se puede borrar.
  const { error: eEnc } = await svc.from("encargos").insert({
    proyecto_id: pComp.id, empresa_id: a.id, titulo_tarea: "Ayuda", via: "asignacion_interna", estado: "esperando_asignacion", tipo_ayuda: "buscar_convocatoria",
  });
  ok(!eEnc, `encargo de prueba creado ${eEnc?.message ?? ""}`);
  const cons2 = await api(a, "GET", `/api/proyectos/${pComp.id}?consecuencias=1`);
  ok(cons2.json?.datos?.encargos === 1, "consecuencias -> 1 encargo");
  const borrarConEncargo = await api(a, "DELETE", `/api/proyectos/${pComp.id}`);
  ok(borrarConEncargo.status === 409 && /encargos/i.test(borrarConEncargo.json?.error ?? ""), `borrar con encargos -> 409 (${borrarConEncargo.status}: ${borrarConEncargo.json?.error})`);

  const borrar = await api(a, "DELETE", `/api/proyectos/${pPar.id}`);
  const { count: docsTras } = await svc.from("documentos_generados").select("id", { count: "exact", head: true }).eq("proyecto_id", pPar.id);
  ok(borrar.status === 200 && docsTras === 0, `borrar -> 200 y su documento generado se va en cascada (${borrar.status}, quedan ${docsTras})`);
  ok((await api(a, "GET", `/api/proyectos/${pPar.id}`)).status === 404, "el proyecto borrado ya no existe");
  await svc.from("encargos").delete().eq("proyecto_id", pComp.id);

  // --- Pantallas ----------------------------------------------------------------------------
  const paginaA = await api(a, "GET", "/proyectos");
  ok(paginaA.status === 200 && paginaA.texto.includes(`Completo editado ${sufijo}`) && paginaA.texto.includes(`Mínimo ${sufijo}`),
    "empresa A - /proyectos muestra sus proyectos");
  const paginaB = await api(b, "GET", "/proyectos");
  ok(paginaB.status === 200 && !paginaB.texto.includes(`Completo editado ${sufijo}`) && paginaB.texto.includes("Aún no tienes proyectos"),
    "empresa B - /proyectos no muestra los de A y dice que no tiene");
  const fichaB = await api(b, "GET", `/proyectos/${pComp.id}`);
  ok(fichaB.status === 200 && fichaB.texto.includes("No encontramos este proyecto") && !fichaB.texto.includes("Completo editado"),
    "empresa B - la ficha de un proyecto de A no lo muestra");
  const fichaA = await api(a, "GET", `/proyectos/${pComp.id}`);
  ok(fichaA.status === 200 && fichaA.texto.includes(`Completo editado ${sufijo}`) && fichaA.texto.includes("Sin definir"),
    "empresa A - su ficha muestra el proyecto y el monto sin definir");
} finally {
  if (convocatorias.length) await svc.from("convocatorias").delete().in("id", convocatorias);
  for (const id of cuentas) {
    await svc.from("encargos").delete().eq("empresa_id", id);
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  if (categorias.length) await svc.from("categorias").delete().in("id", categorias);
  console.log("datos y cuentas de prueba borrados");
}
console.log(fallas ? `${fallas} FALLAS` : "TODO PASÓ");
process.exitCode = fallas ? 1 : 0;
