// Prueba HTTP de países elegibles y moneda (RN-39, RN-40, RF-12 criterio 21,
// RF-116, RF-117 · docs/05 §9.36 · sesión 033) contra la app y Supabase reales.
//
//   npx next start -p 3100                         (en otra terminal, tras next build)
//   PRUEBA_URL=http://localhost:3100 node --env-file=.env.local scripts/prueba-paises-y-moneda.mjs
//
// Crea una empresa temporal y, con service_role, una fuente, una categoría y
// tres convocatorias publicadas: una en COP para Colombia, una solo para
// Estados Unidos y una en USD abierta a todos los países. Si no había tasa del
// dólar, fija una de prueba y la quita al terminar. Borra todo lo que creó.
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
async function pedir(s, ruta, metodo = "GET", cuerpo) {
  const r = await fetch(APP + ruta, {
    method: metodo,
    headers: { ...(s ? { cookie: s.cookie() } : {}), ...(cuerpo ? { "content-type": "application/json", origin: APP } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    redirect: "manual",
  });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* HTML */ }
  return { status: r.status, json, texto };
}

const sufijo = crypto.randomBytes(3).toString("hex");
const hoyCO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const enDias = (n) => new Date(Date.parse(hoyCO) + n * 86400000).toISOString().slice(0, 10);
const cuentas = [], convocatorias = [];
let fuenteId = null, categoriaId = null, tasaCreada = false;

try {
  const clave = crypto.randomBytes(18).toString("base64url");
  const { data: u, error: eU } = await svc.auth.admin.createUser({
    email: `empresa.paises.${sufijo}@example.com`, password: clave, email_confirm: true, user_metadata: { rol: "empresa", nombre: "Empresa países" },
  });
  if (eU) throw eU;
  cuentas.push(u.user.id);
  const emp = sesion();
  const { error: eS } = await emp.cliente.auth.signInWithPassword({ email: u.user.email, password: clave });
  if (eS) throw eS;

  const { data: fuente } = await svc.from("fuentes").insert({ nombre: `Fuente países ${sufijo}`, activa: true }).select("id").single();
  fuenteId = fuente.id;
  const { data: cat } = await svc.from("categorias").insert({ tipo: "sector", nombre: `Sector países ${sufijo}`, activa: true }).select("id").single();
  categoriaId = cat.id;

  const { data: tasaPrevia } = await svc.from("tasas_referencia").select("cop_por_unidad").eq("moneda", "USD").maybeSingle();
  if (!tasaPrevia) {
    await svc.from("tasas_referencia").insert({ moneda: "USD", cop_por_unidad: 4000, vigente_desde: hoyCO });
    tasaCreada = true;
  }
  const tasaUSD = tasaPrevia ? Number(tasaPrevia.cop_por_unidad) : 4000;

  const crear = async (nombre, extra, paises) => {
    const { data, error } = await svc.from("convocatorias").insert({
      fuente_id: fuenteId, nombre: `${nombre} ${sufijo}`, entidad_convocante: "Entidad países", descripcion: "Objeto", cobertura_nacional: true,
      fecha_cierre: enDias(20), url_postulacion: "https://entidad.example.org/x", estado: "publicada", publicada_at: new Date().toISOString(), ...extra,
    }).select("id").single();
    if (error) throw error;
    convocatorias.push(data.id);
    await svc.from("convocatoria_categoria").insert({ convocatoria_id: data.id, categoria_id: categoriaId });
    if (paises.length) await svc.from("convocatoria_pais").insert(paises.map((p) => ({ convocatoria_id: data.id, pais_codigo: p })));
    return data.id;
  };
  const cCO = await crear("Países COP Colombia", { monto_min: 1000000, monto_max: 5000000 }, ["CO"]);
  const cUS = await crear("Países solo EE. UU.", {}, ["US"]);
  const cUSD = await crear("Países USD todos", { todos_los_paises: true, moneda: "USD", monto_min: 1000, monto_max: 2000 }, []);

  // --- RF-12, criterio 21 (RN-39) ---------------------------------------------------
  const porDefecto = await pedir(emp, `/api/convocatorias?q=${sufijo}`);
  const idsDef = (porDefecto.json?.datos ?? []).map((c) => c.id);
  ok(porDefecto.status === 200 && idsDef.includes(cCO) && idsDef.includes(cUSD) && !idsDef.includes(cUS),
    `catálogo por defecto: trae la de Colombia y la de todos los países, no la de solo EE. UU. (${idsDef.length})`);
  const conOtros = await pedir(emp, `/api/convocatorias?q=${sufijo}&incluirOtrosPaises=true`);
  const us = (conOtros.json?.datos ?? []).find((c) => c.id === cUS);
  ok(conOtros.status === 200 && us && us.elegible === false, "con incluirOtrosPaises=true aparece la de EE. UU., marcada no elegible");
  ok((await pedir(emp, "/api/convocatorias?incluirOtrosPaises=quizas")).status === 400, "incluirOtrosPaises inválido -> 400");

  // --- RN-40: moneda y equivalente en pesos -------------------------------------------
  const usd = (porDefecto.json?.datos ?? []).find((c) => c.id === cUSD);
  ok(usd?.moneda === "USD" && usd.montoMin === 1000 && usd.montoMax === 2000, "el monto llega en su moneda, sin convertir (USD 1.000–2.000)");
  ok(usd?.montoMinCop === 1000 * tasaUSD && usd?.montoMaxCop === 2000 * tasaUSD, `y con su equivalente en pesos para comparar (${usd?.montoMinCop}–${usd?.montoMaxCop})`);
  const desde = await pedir(emp, `/api/convocatorias?q=${sufijo}&montoDesde=${(1500 * tasaUSD).toLocaleString("es-CO").replace(/,/g, ".")}`);
  const idsDesde = (desde.json?.datos ?? []).map((c) => c.id);
  ok(desde.status === 200 && idsDesde.includes(cUSD) && !idsDesde.includes(cCO), "filtro «apoya con al menos» compara en pesos: entra la de USD, no la de $5 millones");

  // --- Ficha (CU-08) -----------------------------------------------------------------------
  const fichaUS = await pedir(emp, `/convocatorias/${cUS}`);
  ok(fichaUS.status === 200 && fichaUS.texto.includes("Tu país no es elegible") && fichaUS.texto.includes("Estados Unidos"),
    "la ficha de la de EE. UU. dice «Tu país no es elegible» y nombra el país");
  const fichaUSD = await pedir(emp, `/convocatorias/${cUSD}`);
  ok(fichaUSD.status === 200 && fichaUSD.texto.includes("Todos los países") && fichaUSD.texto.includes("USD") && fichaUSD.texto.includes("COP aprox."),
    "la ficha en USD muestra «Todos los países», el monto en USD y el equivalente aproximado en pesos");

  // --- Postular (RN-39 en la base) ----------------------------------------------------------
  const postUS = await pedir(emp, "/api/postulaciones", "POST", { convocatoriaId: cUS, proyectoId: null });
  ok(postUS.status === 409 && /país/.test(postUS.json?.error ?? ""), `postular a la de EE. UU. -> 409 por país (${postUS.status}: ${postUS.json?.error})`);
  const postCO = await pedir(emp, "/api/postulaciones", "POST", { convocatoriaId: cCO, proyectoId: null });
  ok(postCO.status === 200 || postCO.status === 201, `postular a la de Colombia -> permitido (${postCO.status})`);

  // --- RF-85: el panel de tasas no existe para la empresa ----------------------------------
  ok((await pedir(emp, "/api/admin/tasas")).status === 404, "empresa - GET /api/admin/tasas -> 404");
  ok((await pedir(emp, "/admin/tasas")).status === 404, "empresa - /admin/tasas -> 404");
  ok((await pedir(null, "/api/admin/tasas")).status === 404, "visitante - GET /api/admin/tasas -> 404");
} catch (e) {
  fallas++;
  console.log("FALLA inesperada:", e);
} finally {
  if (convocatorias.length) {
    await svc.from("postulaciones").delete().in("convocatoria_id", convocatorias);
    await svc.from("convocatorias").delete().in("id", convocatorias);
  }
  if (categoriaId) await svc.from("categorias").delete().eq("id", categoriaId);
  if (fuenteId) await svc.from("fuentes").delete().eq("id", fuenteId);
  if (tasaCreada) await svc.from("tasas_referencia").delete().eq("moneda", "USD");
  for (const id of cuentas) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log(`No se pudo borrar la cuenta ${id}: ${error.message}`);
  }
  console.log("datos y cuentas de prueba borrados");
  console.log(fallas ? `\n${fallas} FALLAS` : "TODO PASÓ");
  process.exit(fallas ? 1 : 0);
}
