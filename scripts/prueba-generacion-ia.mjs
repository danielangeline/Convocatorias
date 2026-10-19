// Prueba de la generación, los ajustes, la exportación y el compartir de
// documentos con IA, contra Supabase real (CU-33, CU-34 · RF-48, RF-50, RF-52,
// RF-53, RF-55, RF-58..62, RF-71, RF-72, RF-76, RF-77, RF-78, RF-79, RN-17,
// RN-22, RN-27, RN-28, RNF-20, RNF-30 · docs/05 §9.26 · Sprint 5).
//
//   IA_PROVEEDOR=prueba npm run dev               (en otra terminal; o la
//                                                  configuración "dev-ia-prueba")
//   node --env-file=.env.local scripts/prueba-generacion-ia.mjs
//
// Con el proveedor de prueba no se gasta saldo de OpenAI: responde una sección
// con un marcador [COMPLETAR] por cada sección de la estructura, y falla si el
// contexto contiene FALLA_IA_PRUEBA. Crea sus propias cuentas temporales (dos
// empresas y un consultor aprobado) y borra todo al terminar.
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
  const buffer = Buffer.from(await r.arrayBuffer());
  const texto = buffer.toString("utf8");
  let json = null;
  try { json = JSON.parse(texto); } catch { /* HTML o binario */ }
  return { status: r.status, json, texto, buffer, tipo: r.headers.get("content-type"), disposicion: r.headers.get("content-disposition"), destino: r.headers.get("location") };
}

const sufijo = crypto.randomBytes(3).toString("hex");
const cuentas = [], convocatorias = [];
const hoy = new Date(Date.now() - 5 * 3600 * 1000);  // Colombia
const enDias = (n) => new Date(hoy.getTime() + n * 86400000).toISOString().slice(0, 10);
const creditos = async (id) => {
  const { data } = await svc.from("suscripciones").select("creditos_usados_periodo, creditos_extra").eq("usuario_id", id).single();
  return data;
};

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const crearCuenta = async (rol, nombre, extra = {}) => {
    const { data, error } = await svc.auth.admin.createUser({
      email: `${nombre}.ia.${sufijo}@example.com`, password: clave, email_confirm: true,
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
  const e1 = await crearCuenta("empresa", "empresa1", { nombre_empresa: `Empresa Uno ${sufijo}` });
  const e2 = await crearCuenta("empresa", "empresa2", { nombre_empresa: `Empresa Dos ${sufijo}` });
  const a = await crearCuenta("consultor", "consultor-a");
  await svc.from("consultor_perfiles").update({ nombre_profesional: `Consultora ${sufijo}`, estado_perfil: "aprobado" }).eq("id", a.id);

  const crearConvocatoria = async (nombre, cierre) => {
    const { data, error } = await svc.from("convocatorias").insert({
      nombre, entidad_convocante: "Entidad de prueba", cobertura_nacional: true, fecha_cierre: cierre,
      estado: "publicada", url_postulacion: "https://prueba.gov.co/ia",
    }).select("id").single();
    if (error) throw error;
    convocatorias.push(data.id);
    return data.id;
  };
  const cA = await crearConvocatoria(`Convocatoria IA ${sufijo}`, enDias(20));
  const cV = await crearConvocatoria(`Convocatoria vencida ${sufijo}`, enDias(-1));
  const { data: p1 } = await svc.from("proyectos").insert({ usuario_id: e1.id, nombre: `Proyecto IA ${sufijo}`, problema: "Riego costoso" }).select("id").single();
  const { data: pFalla } = await svc.from("proyectos").insert({ usuario_id: e1.id, nombre: `Proyecto FALLA_IA_PRUEBA ${sufijo}` }).select("id").single();
  const { data: p2 } = await svc.from("proyectos").insert({ usuario_id: e2.id, nombre: `Proyecto ajeno ${sufijo}` }).select("id").single();

  // --- Autorización de rutas (RNF-30) ------------------------------------------------
  const anon = await api(null, "POST", "/api/documentos/generar", { proyectoId: p1.id, convocatoriaId: cA });
  ok(anon.status === 307 && /\/login/.test(anon.destino ?? ""), `RNF-30: anónimo -> /login (${anon.status})`);
  ok((await api(a, "POST", "/api/documentos/generar", { proyectoId: p1.id, convocatoriaId: cA })).status === 403, "CU-33: el consultor no genera -> 403");
  ok((await api(e1, "POST", "/api/documentos/generar", { proyectoId: p1.id, convocatoriaId: cA }, { origen: "https://otro.example" })).status === 403,
    "RNF-30: generar desde otro origen -> 403");

  // --- Precondiciones (RF-78, RN-30) ---------------------------------------------------
  ok((await api(e1, "POST", "/api/documentos/generar", { proyectoId: p2.id, convocatoriaId: cA })).status === 404, "RN-30: con un proyecto ajeno -> 404");
  const vencida = await api(e1, "POST", "/api/documentos/generar", { proyectoId: p1.id, convocatoriaId: cV });
  ok(vencida.status === 409, `RF-78: sobre una vencida -> 409 (${vencida.status})`);
  ok((await creditos(e1.id)).creditos_usados_periodo === 0, "RF-78: y no cobra");

  // --- RN-17: la fallida no cobra --------------------------------------------------------
  const fallida = await api(e1, "POST", "/api/documentos/generar", { proyectoId: pFalla.id, convocatoriaId: cA });
  ok(fallida.status === 502 && /No se descontó ningún crédito/.test(fallida.json?.error ?? ""), `RF-62, RN-17: fallo controlado con su mensaje (${fallida.status})`);
  const { data: consumoFallido } = await svc.from("consumos_ia").select("exito, credito_descontado, tokens_entrada, modelo").eq("empresa_id", e1.id).eq("exito", false);
  ok((await creditos(e1.id)).creditos_usados_periodo === 0 && consumoFallido?.length === 1 && !consumoFallido[0].credito_descontado && consumoFallido[0].tokens_entrada > 0,
    "RN-17, RF-52: no descuenta y queda el consumo fallido con sus tokens");
  const { count: reservas } = await svc.from("documentos_generados").select("id", { count: "exact", head: true }).eq("usuario_id", e1.id);
  ok(reservas === 0, "RN-17: la reserva del fallo se libera");

  // --- Generar (CU-33) ------------------------------------------------------------------
  const t0 = Date.now();
  const gen = await api(e1, "POST", "/api/documentos/generar", { proyectoId: p1.id, convocatoriaId: cA });
  const d1 = gen.json?.datos?.id;
  ok(gen.status === 201 && d1, `CU-33: genera (${gen.status}, ${Date.now() - t0} ms)`);
  ok((await creditos(e1.id)).creditos_usados_periodo === 1, "RF-48: descuenta un crédito");
  const leido = await api(e1, "GET", `/api/documentos/${d1}`);
  const doc = leido.json?.datos;
  ok(leido.status === 200 && doc?.secciones?.length === 9 && doc.secciones[0].titulo === "Resumen ejecutivo",
    `RF-56: sin requisitos ni TDR, la estructura estándar (${doc?.secciones?.length} secciones)`);
  ok(doc?.pendientes?.length === 9 && doc.estado === "generado" && doc.version === 1, "RF-57: los pendientes salen de los marcadores");
  const { data: consumo } = await svc.from("consumos_ia").select("tokens_entrada, tokens_salida, costo_estimado, modelo, plantilla_id, credito_descontado").eq("documento_id", d1).single();
  ok(consumo?.credito_descontado && consumo.tokens_entrada > 0 && Number(consumo.costo_estimado) > 0 && consumo.modelo && consumo.plantilla_id,
    `RF-52: consumo con tokens, costo (USD ${consumo?.costo_estimado}), modelo y plantilla`);
  ok((await api(e2, "GET", `/api/documentos/${d1}`)).status === 404, "RN-22: otra empresa no lo ve -> 404");
  ok((await api(a, "GET", `/api/documentos/${d1}`)).status === 404, "RN-22: el consultor sin autorización no lo ve -> 404");
  const lista = await api(e1, "GET", "/api/documentos");
  ok(lista.json?.datos?.length === 1 && lista.json.datos[0].id === d1, "RN-30: la lista de la empresa lo trae");
  ok((await api(e2, "GET", "/api/documentos")).json?.datos?.length === 0, "RN-30: la de otra empresa, no");

  // --- Editar (RF-58) ------------------------------------------------------------------
  const secciones = doc.secciones.map((s, i) => (i === 0 ? { ...s, contenido: "Resumen escrito por la empresa." } : s));
  const editado = await api(e1, "PATCH", `/api/documentos/${d1}`, { secciones });
  ok(editado.status === 200 && editado.json?.datos?.estado === "editado" && editado.json.datos.pendientes.length === 8 && editado.json.datos.ultimaEdicionPor === "empresa",
    "RF-58: edición libre, recalcula pendientes y marca editado");
  ok((await creditos(e1.id)).creditos_usados_periodo === 1, "RF-58: editar no cuesta");
  ok((await api(e2, "PATCH", `/api/documentos/${d1}`, { secciones })).status === 404, "RN-22: otra empresa no lo edita -> 404");
  ok((await api(e1, "PATCH", `/api/documentos/${d1}`, { secciones: [] })).status === 400, "RF-58: sin secciones -> 400");

  // --- Ajustes (RF-59) -------------------------------------------------------------------
  // Revisión de seguridad: tres ajustes a la vez → uno llama a la IA, los otros se rechazan antes.
  const simultaneos = await Promise.all([1, 2, 3].map(() => api(e1, "POST", `/api/documentos/${d1}/ajustar`, { indicacion: "hazlo más breve" })));
  const { count: consumosAjuste } = await svc.from("consumos_ia").select("id", { count: "exact", head: true }).eq("documento_id", d1).eq("tipo", "ajuste");
  ok(simultaneos.filter((r) => r.status === 200).length === 1 && simultaneos.filter((r) => r.status === 409).length === 2 && consumosAjuste === 1,
    `§9.26: de tres ajustes simultáneos solo uno llega a la IA (${simultaneos.map((r) => r.status).join(", ")}; consumos ${consumosAjuste})`);
  await svc.from("documentos_generados").update({ ajustes_usados: 0 }).eq("id", d1);
  for (let i = 1; i <= 3; i++) {
    const r = await api(e1, "POST", `/api/documentos/${d1}/ajustar`, { indicacion: `hazlo más breve ${i}` });
    ok(r.status === 200 && r.json?.datos?.ajustesUsados === i, `RF-59: ajuste gratis ${i} (${r.status})`);
  }
  ok((await creditos(e1.id)).creditos_usados_periodo === 1, "RN-17: tres ajustes gratis no cobran");
  const cuarto = await api(e1, "POST", `/api/documentos/${d1}/ajustar`, { indicacion: "usa un tono más técnico" });
  ok(cuarto.status === 200 && (await creditos(e1.id)).creditos_usados_periodo === 2, "RN-17: el cuarto cobra un crédito");
  ok((await api(e1, "POST", `/api/documentos/${d1}/ajustar`, { indicacion: "x" })).status === 400, "CU-34: indicación vacía -> 400");

  // --- Regenerar (CU-34 5a, RF-61) -----------------------------------------------------
  const regen = await api(e1, "POST", "/api/documentos/generar", { proyectoId: p1.id, convocatoriaId: cA });
  const d2 = regen.json?.datos?.id;
  const { data: v2 } = await svc.from("documentos_generados").select("version, documento_padre_id").eq("id", d2).single();
  ok(regen.status === 201 && v2?.version === 2 && v2.documento_padre_id === d1, "RF-61: regenerar crea la versión 2 y conserva la 1");
  ok((await creditos(e1.id)).creditos_usados_periodo === 3, "RN-17: regenerar cobra un crédito");
  const lista2 = await api(e1, "GET", "/api/documentos");
  ok(lista2.json?.datos?.length === 1 && lista2.json.datos[0].id === d2, "RF-61: la lista muestra solo la última versión");

  // --- RF-50: sin cupo ---------------------------------------------------------------------
  const sinCupo = await api(e1, "POST", "/api/documentos/generar", { proyectoId: p1.id, convocatoriaId: cA });
  ok(sinCupo.status === 402, `RF-50: agotados los 3 créditos del trial, no genera -> ${sinCupo.status}`);
  ok((await api(e1, "POST", `/api/documentos/${d1}/ajustar`, { indicacion: "otra vez más breve" })).status === 402,
    "RF-50: ni un quinto ajuste -> 402");

  // --- Exportar (RF-60, RF-72) --------------------------------------------------------------
  const word = await api(e1, "GET", `/api/documentos/${d2}/exportar`);
  ok(word.status === 200 && /wordprocessingml/.test(word.tipo ?? "") && word.buffer.subarray(0, 2).toString() === "PK" && /\.docx"/.test(word.disposicion ?? ""),
    `RF-60: descarga un .docx real (${word.buffer.length} bytes)`);
  const { data: exp } = await svc.from("documentos_generados").select("estado").eq("id", d2).single();
  ok(exp?.estado === "exportado", "RF-60: queda como exportado");
  ok((await api(e2, "GET", `/api/documentos/${d2}/exportar`)).status === 404, "RF-72: otra empresa -> 404");

  // --- Compartir con el consultor (RF-71, RN-27, RF-79) --------------------------------------
  ok((await api(e1, "POST", `/api/documentos/${d2}/compartir`, { consultorId: a.id })).status === 409, "RF-71: sin encargo en curso no se comparte -> 409");
  const enc = await api(e1, "POST", "/api/encargos", { proyectoId: p1.id, consultorId: a.id, tipoAyuda: "convocatoria_especifica", convocatoriaId: cA, titulo: `Revisar documento ${sufijo}`, descripcion: "" });
  ok(enc.status === 201, `la empresa solicita a la consultora (${enc.status})`);
  ok((await api(a, "POST", `/api/consultor/encargos/${enc.json?.datos?.id}/responder`, { acepta: true })).status === 200, "la consultora acepta");
  ok((await api(a, "GET", `/api/documentos/${d2}`)).status === 404, "RN-22: aceptar el encargo no da acceso por sí solo -> 404");
  ok((await api(a, "POST", `/api/documentos/${d2}/compartir`, { consultorId: a.id })).status === 403, "RF-71: el consultor no se autoriza a sí mismo -> 403");
  const compartido = await api(e1, "POST", `/api/documentos/${d2}/compartir`, { consultorId: a.id });
  ok(compartido.status === 200 && compartido.json?.datos?.compartidoConConsultorId === a.id, "RF-71: la empresa lo comparte");
  const delConsultor = await api(a, "GET", `/api/documentos/${d2}`);
  ok(delConsultor.status === 200 && delConsultor.json?.datos?.convocatoriaNombre === `Convocatoria IA ${sufijo}`, "RN-27: el consultor autorizado lo lee");
  const { count: lecturas } = await svc.from("documento_lecturas").select("id", { count: "exact", head: true }).eq("documento_id", d2);
  ok(lecturas === 1, `RF-79: su lectura queda registrada (${lecturas})`);
  const editaConsultor = await api(a, "PATCH", `/api/documentos/${d2}`, { secciones: delConsultor.json.datos.secciones.map((s, i) => (i === 1 ? { ...s, contenido: "Aporte de la consultora." } : s)) });
  ok(editaConsultor.status === 200 && editaConsultor.json?.datos?.ultimaEdicionPor === "consultor", "RN-22, RNF-11: el consultor edita y queda registrado");
  ok((await api(a, "PATCH", `/api/documentos/${d2}`, { secciones: delConsultor.json.datos.secciones, titulo: "Otro título" })).status === 403,
    "RN-22: el consultor no cambia el título -> 403");
  ok((await api(a, "GET", `/api/documentos/${d2}/exportar`)).status === 403, "RF-72: el consultor no exporta -> 403");
  ok((await api(a, "POST", "/api/documentos/generar", { proyectoId: p1.id, convocatoriaId: cA })).status === 403, "CU-34 5c: ni regenera -> 403");
  const lc = await api(a, "GET", "/api/documentos");
  ok(lc.status === 200 && lc.json?.datos?.length === 1 && lc.json.datos[0].id === d2, "RN-27: su lista trae solo el compartido");

  // RF-77, RN-28: sin cupo de la empresa, el ajuste del consultor se rechaza con su mensaje.
  const ajusteSinCupo = await api(a, "POST", `/api/documentos/${d2}/ajustar`, { indicacion: "hazlo más breve" });
  ok(ajusteSinCupo.status === 200, `RF-59: el consultor usa un ajuste gratis de la versión 2 (${ajusteSinCupo.status})`);
  await svc.from("documentos_generados").update({ ajustes_usados: 3 }).eq("id", d2);
  const rf77 = await api(a, "POST", `/api/documentos/${d2}/ajustar`, { indicacion: "hazlo más breve" });
  ok(rf77.status === 402 && /Avísale/.test(rf77.json?.error ?? ""), `RF-77: sin cupo de la empresa, se le pide avisarle (${rf77.status})`);
  await svc.from("suscripciones").update({ creditos_extra: 1 }).eq("usuario_id", e1.id);
  const rn28 = await api(a, "POST", `/api/documentos/${d2}/ajustar`, { indicacion: "hazlo más breve" });
  const { data: consumoA } = await svc.from("consumos_ia").select("empresa_id, credito_descontado").eq("documento_id", d2).eq("usuario_id", a.id).eq("credito_descontado", true);
  ok(rn28.status === 200 && (await creditos(e1.id)).creditos_extra === 0 && consumoA?.[0]?.empresa_id === e1.id, "RN-28: el cuarto ajuste del consultor se cobra a la empresa");

  // Revocar a mano y por el encargo (RF-71, RF-76).
  ok((await api(e1, "POST", `/api/documentos/${d2}/revocar`)).status === 200, "RF-71: la empresa revoca");
  ok((await api(a, "GET", `/api/documentos/${d2}`)).status === 404, "RF-71: el consultor pierde el acceso en la siguiente petición");
  await api(e1, "POST", `/api/documentos/${d2}/compartir`, { consultorId: a.id });
  await svc.from("encargos").update({ estado: "cancelado", motivo_cancelacion: "Prueba" }).eq("id", enc.json.datos.id);
  ok((await api(a, "GET", `/api/documentos/${d2}`)).status === 404, "RF-76: al cancelarse el encargo, lo pierde sin que nadie revoque");
  const pantallaA = await api(a, "GET", `/consultor/documentos/${d2}`);
  ok(pantallaA.status === 200 && pantallaA.texto.includes("No tienes acceso a este documento"), "RF-76: y la pantalla se lo dice");

  // --- Pantallas de la empresa --------------------------------------------------------------
  const pantalla = await api(e1, "GET", `/documentos/${d2}`);
  ok(pantalla.status === 200 && pantalla.texto.includes("Exportar a Word") && pantalla.texto.includes(`Proyecto IA ${sufijo}`), "CU-34: la pantalla del documento");
  const pantallaAjena = await api(e2, "GET", `/documentos/${d2}`);
  ok(pantallaAjena.status === 200 && pantallaAjena.texto.includes("No encontramos este documento"), "RN-22: la de otra empresa no lo muestra");
} catch (e) {
  console.error("ERROR", e);
  fallas++;
} finally {
  // Las convocatorias se borran después de los documentos (FK sin cascada).
  for (const id of cuentas) await svc.auth.admin.deleteUser(id);
  for (const id of convocatorias) {
    await svc.from("documentos_generados").delete().eq("convocatoria_id", id);
    await svc.from("encargos").delete().eq("convocatoria_id", id);
    const { error } = await svc.from("convocatorias").delete().eq("id", id);
    if (error) console.error("no se pudo borrar la convocatoria", id, error.message);
  }
  console.log(fallas === 0 ? "\nTODO OK" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
