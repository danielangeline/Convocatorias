// Prueba de las postulaciones de la empresa contra Supabase real (RF-17, RF-18,
// RF-19, RF-21, RF-73, RF-78, RF-83, RN-04, RN-30, RN-35, RNF-30 · CU-11, CU-12,
// CU-13 · docs/05 §9.19 · Sprint 3 pasos 3 y 4).
//
//   npm run dev                                   (en otra terminal)
//   node --env-file=.env.local scripts/prueba-postulaciones.mjs
//
// Crea sus propias cuentas temporales (dos empresas y un consultor) y, con
// service_role, tres convocatorias (vigente, vencida y borrador) con requisitos.
// Borra todo al terminar.
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
const cuentas = [], convocatorias = [];

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.postulaciones.${sufijo}@example.com`, password: clave, email_confirm: true, user_metadata: { rol, nombre },
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

  const crearConvocatoria = async (nombre, cierre, estado) => {
    const { data, error } = await svc.from("convocatorias").insert({
      nombre: `${nombre} ${sufijo}`, entidad_convocante: "Entidad de prueba", cobertura_nacional: true,
      fecha_cierre: cierre, estado, url_postulacion: "https://entidad.gov.co/radicar",
    }).select("id").single();
    if (error) throw error;
    convocatorias.push(data.id);
    await svc.from("requisitos_convocatoria").insert([
      { convocatoria_id: data.id, descripcion: `RUT ${sufijo}`, tipo: "documento", obligatorio: true, orden: 0 },
      { convocatoria_id: data.id, descripcion: `Carta ${sufijo}`, tipo: "documento", obligatorio: false, orden: 1 },
    ]);
    return data.id;
  };
  const vigente = await crearConvocatoria("Vigente", enDias(20), "publicada");
  const vencida = await crearConvocatoria("Vencida", enDias(-1), "publicada");
  const borrador = await crearConvocatoria("Borrador", enDias(20), "borrador");

  const p1 = (await api(a, "POST", "/api/proyectos", { nombre: `Proyecto uno ${sufijo}` })).json.datos;
  const p2 = (await api(a, "POST", "/api/proyectos", { nombre: `Proyecto dos ${sufijo}` })).json.datos;
  const pB = (await api(b, "POST", "/api/proyectos", { nombre: `Proyecto de B ${sufijo}` })).json.datos;

  // --- RNF-30: quién llega a los endpoints ------------------------------------------------
  const anon = await api(null, "GET", "/api/postulaciones");
  ok(anon.status === 307 && /\/login/.test(anon.destino ?? ""), `visitante - GET /api/postulaciones -> /login (${anon.status})`);
  ok((await api(con, "GET", "/api/postulaciones")).status === 403, "consultor - GET /api/postulaciones -> 403");
  ok((await api(con, "POST", "/api/postulaciones", { convocatoriaId: vigente })).status === 403, "consultor - POST /api/postulaciones -> 403");
  ok((await api(con, "PATCH", `/api/checklist/${crypto.randomUUID()}`, { completado: true })).status === 403, "consultor - PATCH /api/checklist -> 403");
  ok((await api(a, "POST", "/api/postulaciones", { convocatoriaId: vigente }, { origen: "https://otro.example" })).status === 403,
    "empresa desde otro origen - POST -> 403");

  // --- RF-17, RN-04: iniciar ----------------------------------------------------------------
  const crear = await api(a, "POST", "/api/postulaciones", { convocatoriaId: vigente, proyectoId: p1.id });
  const idA = crear.json?.datos?.id;
  ok(crear.status === 201 && crear.json?.datos?.creada === true, `iniciar -> 201 creada (${crear.status})`);
  const det = (await api(a, "GET", `/api/postulaciones/${idA}`)).json?.datos;
  ok(det?.estado === "en_preparacion" && det?.usuarioId === a.id && det?.proyectoId === p1.id, "nace en preparación, de la sesión y con su proyecto");
  ok(det?.checklist?.length === 2 && det.checklist[0].descripcion === `RUT ${sufijo}` && det.checklist[0].obligatorio && !det.checklist[1].obligatorio,
    "checklist copiado de los requisitos, en su orden y con obligatorio");
  ok(det?.historial?.length === 1 && det.historial[0].estadoAnterior === null, "historial con la creación");
  ok(det?.convocatoria?.id === vigente && det?.convocatoria?.urlPostulacion === "https://entidad.gov.co/radicar", "trae su convocatoria con el enlace oficial");

  const otraVez = await api(a, "POST", "/api/postulaciones", { convocatoriaId: vigente, proyectoId: p1.id });
  ok(otraVez.status === 200 && otraVez.json?.datos?.creada === false && otraVez.json?.datos?.id === idA,
    `CU-11 1c - el mismo par otra vez -> 200 con la existente (${otraVez.status})`);
  const conP2 = await api(a, "POST", "/api/postulaciones", { convocatoriaId: vigente, proyectoId: p2.id });
  ok(conP2.status === 201, `RN-35 - otro proyecto a la misma convocatoria -> 201 (${conP2.status})`);
  const sinProyecto = await api(a, "POST", "/api/postulaciones", { convocatoriaId: vigente });
  const idSin = sinProyecto.json?.datos?.id;
  ok(sinProyecto.status === 201, `sin proyecto -> 201 (${sinProyecto.status})`);

  for (const [cuerpo, nombre, estado, patron] of [
    [{ convocatoriaId: vencida, proyectoId: p1.id }, "RF-78 - convocatoria vencida", 409, /ya no está abierta/],
    [{ convocatoriaId: borrador }, "RN-33 - borrador", 404, /no existe/],
    [{ convocatoriaId: crypto.randomUUID() }, "convocatoria inexistente", 404, /no existe/],
    [{ convocatoriaId: vigente, proyectoId: pB.id }, "RN-30 - proyecto de otra empresa", 404, /proyecto no existe/],
    [{}, "sin convocatoria", 400, /convocatoria/],
    [{ convocatoriaId: vigente, proyectoId: "x" }, "proyecto que no es uuid", 400, /proyecto/i],
  ]) {
    const r = await api(a, "POST", "/api/postulaciones", cuerpo);
    ok(r.status === estado && patron.test(r.json?.error ?? ""), `${nombre} -> ${estado} (${r.status}: ${r.json?.error})`);
  }

  // RN-04: editar los requisitos después no altera el checklist ya copiado.
  await svc.from("requisitos_convocatoria").update({ descripcion: "Cambiado por el admin" }).eq("convocatoria_id", vigente).eq("orden", 0);
  const trasEditar = (await api(a, "GET", `/api/postulaciones/${idA}`)).json?.datos;
  ok(trasEditar?.checklist?.[0]?.descripcion === `RUT ${sufijo}`, "RN-04 - editar un requisito no cambia el checklist copiado");

  // --- RF-18: checklist -----------------------------------------------------------------------
  const item = det.checklist[0].id;
  const marca = await api(a, "PATCH", `/api/checklist/${item}`, { completado: true });
  ok(marca.status === 200 && marca.json?.datos?.completado === true, `marcar un ítem -> 200 (${marca.status})`);
  ok((await api(a, "PATCH", `/api/checklist/${item}`, { completado: "sí" })).status === 400, "completado que no es booleano -> 400");
  ok((await api(b, "PATCH", `/api/checklist/${item}`, { completado: false })).status === 404, "RN-30 - empresa B marcando el checklist de A -> 404");
  const { data: sigue } = await svc.from("postulacion_checklist").select("completado").eq("id", item).single();
  ok(sigue.completado === true, "el ítem sigue marcado tras el intento de B");

  // --- CU-13 3a, RN-35: vincular proyecto ------------------------------------------------------
  const vincOcupado = await api(a, "PATCH", `/api/postulaciones/${idSin}`, { proyectoId: p2.id });
  ok(vincOcupado.status === 409 && /ya tiene una postulación en curso/.test(vincOcupado.json?.error ?? ""),
    `vincular un proyecto que ya tiene postulación en curso en esa convocatoria -> 409 (${vincOcupado.status})`);
  const p3 = (await api(a, "POST", "/api/proyectos", { nombre: `Proyecto tres ${sufijo}` })).json.datos;
  const vinc = await api(a, "PATCH", `/api/postulaciones/${idSin}`, { proyectoId: p3.id });
  ok(vinc.status === 200 && vinc.json?.datos?.proyectoId === p3.id, `vincular a la que no tiene -> 200 (${vinc.status})`);
  const cambiar = await api(a, "PATCH", `/api/postulaciones/${idSin}`, { proyectoId: p1.id });
  ok(cambiar.status === 409 && /no se puede cambiar/.test(cambiar.json?.error ?? ""), `cambiar el proyecto ya vinculado -> 409 (${cambiar.status})`);
  const { error: eDirecto } = await a.cliente.from("postulaciones").update({ proyecto_id: null }).eq("id", idSin);
  ok(eDirecto?.hint === "proyecto_fijo", `desvincular escribiendo directamente en la tabla -> proyecto_fijo (${eDirecto?.hint})`);
  ok((await api(a, "PATCH", `/api/postulaciones/${idSin}`, { proyectoId: pB.id })).status === 409, "vincular el proyecto de otra empresa a una que ya tiene -> 409");

  // --- RF-19, RF-83: estados ---------------------------------------------------------------------
  const salto = await api(a, "POST", `/api/postulaciones/${idA}/estado`, { estado: "aprobada" });
  ok(salto.status === 409 && /no está permitido/.test(salto.json?.error ?? ""), `saltar de en preparación a aprobada -> 409 (${salto.status})`);
  const { error: eSalto } = await a.cliente.from("postulaciones").update({ estado: "aprobada" }).eq("id", idA);
  ok(eSalto?.hint === "transicion_invalida", `el mismo salto escribiendo directamente en la tabla -> transicion_invalida (${eSalto?.hint})`);
  ok((await api(a, "POST", `/api/postulaciones/${idA}/estado`, { estado: "inventado" })).status === 400, "estado inexistente -> 400");
  const presentar = await api(a, "POST", `/api/postulaciones/${idA}/estado`, { estado: "presentada" });
  ok(presentar.status === 200 && presentar.json?.datos?.estado === "presentada" && presentar.json?.datos?.historial?.length === 2,
    `presentar -> 200 y queda en el historial (${presentar.status})`);
  const trasPresentar = await api(a, "PATCH", `/api/checklist/${det.checklist[1].id}`, { completado: true });
  ok(trasPresentar.status === 200, `RN-35 - el checklist se sigue marcando después de presentar (${trasPresentar.status})`);
  ok((await api(b, "POST", `/api/postulaciones/${idA}/estado`, { estado: "en_evaluacion" })).status === 404, "RN-30 - empresa B cambiando el estado de A -> 404");
  const sinConfirmar = await api(a, "POST", `/api/postulaciones/${idA}/estado`, { estado: "cerrada" });
  ok(sinConfirmar.status === 400 && /Confirma/.test(sinConfirmar.json?.error ?? ""), `cerrar sin confirmar -> 400 (${sinConfirmar.status})`);
  const cerrar = await api(a, "POST", `/api/postulaciones/${idA}/estado`, { estado: "cerrada", confirmado: true });
  ok(cerrar.status === 200 && cerrar.json?.datos?.estado === "cerrada", `cerrar con confirmación -> 200 (${cerrar.status})`);
  const reabrir = await api(a, "POST", `/api/postulaciones/${idA}/estado`, { estado: "en_preparacion" });
  ok(reabrir.status === 409, `una cerrada no se reabre -> 409 (${reabrir.status})`);
  const marcarCerrada = await api(a, "PATCH", `/api/checklist/${item}`, { completado: false });
  ok(marcarCerrada.status === 409 && /cerrada/.test(marcarCerrada.json?.error ?? ""), `RN-35 - marcar el checklist de una cerrada -> 409 (${marcarCerrada.status})`);
  const nueva = await api(a, "POST", "/api/postulaciones", { convocatoriaId: vigente, proyectoId: p1.id });
  ok(nueva.status === 201 && nueva.json?.datos?.id !== idA, `RN-35 - cerrada la anterior, el par admite una nueva -> 201 (${nueva.status})`);

  // --- RN-30: la otra empresa no ve nada ------------------------------------------------------------
  const listaB = await api(b, "GET", "/api/postulaciones");
  ok(listaB.status === 200 && (listaB.json?.datos ?? []).length === 0, "empresa B - su lista no trae las postulaciones de A");
  ok((await api(b, "GET", `/api/postulaciones/${idA}`)).status === 404, "empresa B - detalle de una postulación de A -> 404");
  ok((await api(b, "PATCH", `/api/postulaciones/${idSin}`, { proyectoId: pB.id })).status === 404, "empresa B - vincular en una postulación de A -> 404");
  const { data: directoB } = await b.cliente.from("postulacion_checklist").select("id").eq("id", item);
  ok((directoB ?? []).length === 0, "empresa B leyendo el checklist directamente -> 0 filas");
  const listaA = await api(a, "GET", "/api/postulaciones");
  ok((listaA.json?.datos ?? []).length === 4, `empresa A - ve sus 4 postulaciones (${(listaA.json?.datos ?? []).length})`);

  // --- Pantallas ---------------------------------------------------------------------------------------
  const paginaA = await api(a, "GET", "/postulaciones");
  ok(paginaA.status === 200 && paginaA.texto.includes(`Vigente ${sufijo}`) && paginaA.texto.includes(`Proyecto tres ${sufijo}`),
    "empresa A - /postulaciones muestra sus postulaciones con convocatoria y proyecto");
  const paginaB = await api(b, "GET", "/postulaciones");
  // El nombre de la convocatoria no sirve de señal: es catálogo y el layout lo entrega a toda empresa.
  const deA = [idA, idSin, `Proyecto tres ${sufijo}`].filter((t) => paginaB.texto.includes(t));
  ok(paginaB.status === 200 && deA.length === 0 && paginaB.texto.includes("Aún no tienes postulaciones"),
    `empresa B - /postulaciones no muestra las de A y dice que no tiene (${paginaB.status}, de A: ${deA.join(", ") || "nada"})`);
  const detalleA = await api(a, "GET", `/postulaciones/${idSin}`);
  ok(detalleA.status === 200 && detalleA.texto.includes("Ir al portal de la entidad") && detalleA.texto.includes(`RUT ${sufijo}`),
    "empresa A - el detalle muestra el portal de la entidad (RF-73) y el checklist");
  ok(/Ir al portal de la entidad[\s\S]*Solicitar consultor/.test(detalleA.texto), "RF-73 - el portal de la entidad va antes que solicitar consultor");
  const detalleB = await api(b, "GET", `/postulaciones/${idSin}`);
  ok(detalleB.status === 200 && detalleB.texto.includes("No encontramos esta postulación") && !detalleB.texto.includes(`RUT ${sufijo}`),
    "empresa B - el detalle de una postulación de A no la muestra");
  const existente = await api(a, "GET", `/postulaciones/${idSin}?existente=1`);
  ok(existente.texto.includes("Ya tenías esta postulación en curso"), "CU-11 1c - el detalle avisa que abrió la existente");
  const cerradaPag = await api(a, "GET", `/postulaciones/${idA}`);
  ok(cerradaPag.texto.includes("el checklist queda como constancia"), "CU-12 2a - el detalle de una cerrada dice que el checklist es de solo lectura");
} finally {
  if (cuentas.length) await svc.from("postulaciones").delete().in("usuario_id", cuentas);
  if (convocatorias.length) await svc.from("convocatorias").delete().in("id", convocatorias);
  for (const id of cuentas) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  console.log("datos y cuentas de prueba borrados");
}
console.log(fallas ? `${fallas} FALLAS` : "TODO PASÓ");
process.exitCode = fallas ? 1 : 0;
