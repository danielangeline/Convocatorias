// Rendimiento del catálogo con 1.000 convocatorias (RNF-04 · Sprint 4 paso 5).
//
//   npm run dev        (o el build de producción; PRUEBA_URL lo elige)
//   node --env-file=.env.local scripts/prueba-rendimiento-catalogo.mjs
//
// Siembra 1.000 convocatorias publicadas y vigentes con categorías y
// departamentos, mide el catálogo de la empresa (listado, filtros y pantalla)
// varias veces y exige que cada mediana y cada máximo queden bajo 2 s. Borra
// todo al terminar. Las estadísticas de Postgres se actualizan antes de medir
// (sin ellas un plan puede degradarse, como pasó con las sugerencias).
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.PRUEBA_URL ?? "http://localhost:3000";
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TOTAL = Number(process.env.PRUEBA_TOTAL ?? 1000), REPETICIONES = 5, LIMITE_MS = 2000;
let N = 0;
let fallas = 0;
const ok = (c, d) => { console.log(c ? "ok   " : "FALLA", d); if (!c) fallas++; };

const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const dia = (n) => new Date(Date.parse(hoy + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const sufijo = crypto.randomBytes(3).toString("hex");
const marca = `Rendimiento ${sufijo}`;
let cuenta = null;
const categorias = [];

try {
  // --- Datos ------------------------------------------------------------------------
  const { data: cats } = await svc.from("categorias").insert([
    { tipo: "sector", nombre: `Sector ${marca}`, activa: true },
    { tipo: "tipo_proyecto", nombre: `Tipo ${marca}`, activa: true },
  ]).select("id, tipo");
  categorias.push(...cats.map((c) => c.id));
  const { data: deps } = await svc.from("departamentos").select("codigo");
  // RNF-04 pide "hasta 1.000": se siembra lo que falte para llegar justo a TOTAL
  // vigentes, contando las reales. Más allá de 1.000, PostgREST corta el listado
  // (max_rows): es un hallazgo anotado, no lo que esta prueba mide.
  const { count: existentes } = await svc.from("convocatorias").select("id", { count: "exact", head: true })
    .eq("estado", "publicada").gte("fecha_cierre", hoy);
  N = TOTAL - existentes;
  const filas = Array.from({ length: N }, (_, i) => ({
    nombre: `${marca} convocatoria ${i} ${["innovación", "agro", "turismo", "energía", "salud"][i % 5]}`,
    entidad_convocante: `Entidad ${i % 40} ${marca}`,
    descripcion: "Financiar proyectos de prueba de rendimiento",
    cobertura_nacional: i % 3 === 0,
    monto_min: 10_000_000 * (1 + (i % 10)),
    monto_max: 100_000_000 * (1 + (i % 10)),
    fecha_cierre: dia(5 + (i % 300)),
    estado: "publicada",
    url_postulacion: `https://prueba.gov.co/rendimiento/${i}`,
  }));
  const ids = [];
  const t0 = Date.now();
  for (let i = 0; i < filas.length; i += 200) {
    const { data, error } = await svc.from("convocatorias").insert(filas.slice(i, i + 200)).select("id");
    if (error) throw error;
    ids.push(...data.map((d) => d.id));
  }
  const relaciones = ids.flatMap((id, i) => [{ convocatoria_id: id, categoria_id: cats[i % 2].id }]);
  for (let i = 0; i < relaciones.length; i += 500) await svc.from("convocatoria_categoria").insert(relaciones.slice(i, i + 500));
  const cobertura = ids.flatMap((id, i) => (i % 3 === 0 ? [] : [{ convocatoria_id: id, departamento_codigo: deps[i % deps.length].codigo }]));
  for (let i = 0; i < cobertura.length; i += 500) await svc.from("convocatoria_departamento").insert(cobertura.slice(i, i + 500));
  console.log(`(sembradas ${ids.length} convocatorias en ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  execSync("npx supabase db query --linked \"analyze public.convocatorias; analyze public.convocatoria_categoria; analyze public.convocatoria_departamento; analyze public.categorias;\"", { stdio: "ignore" });

  // --- Empresa --------------------------------------------------------------------
  const clave = crypto.randomBytes(18).toString("base64url");
  const { data: u, error: eU } = await svc.auth.admin.createUser({
    email: `empresa.rendimiento.${sufijo}@example.com`, password: clave, email_confirm: true,
    user_metadata: { rol: "empresa", nombre: "E", nombre_empresa: marca, consentimiento_datos: true },
  });
  if (eU) throw eU;
  cuenta = u.user.id;
  const jar = new Map();
  const cliente = createServerClient(URL_, ANON, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (c) => c.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) },
  });
  await cliente.auth.signInWithPassword({ email: u.user.email, password: clave });
  const cookie = () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ");

  const medir = async (ruta) => {
    const tiempos = [];
    let ultima = null;
    await fetch(APP + ruta, { headers: { cookie: cookie() } });  // calienta la compilación en desarrollo
    for (let i = 0; i < REPETICIONES; i++) {
      const t = performance.now();
      const r = await fetch(APP + ruta, { headers: { cookie: cookie() } });
      ultima = { status: r.status, texto: await r.text() };
      tiempos.push(performance.now() - t);
    }
    tiempos.sort((a, b) => a - b);
    return { mediana: tiempos[Math.floor(tiempos.length / 2)], maximo: tiempos[tiempos.length - 1], ...ultima };
  };
  const casos = [
    ["listado completo", "/api/convocatorias"],
    ["texto libre", `/api/convocatorias?q=${encodeURIComponent("agro " + sufijo)}`],
    ["sector", `/api/convocatorias?sector=${cats.find((c) => c.tipo === "sector").id}`],
    ["departamento (con las nacionales)", "/api/convocatorias?departamento=05"],
    ["monto y cierre combinados", `/api/convocatorias?montoHasta=${encodeURIComponent("300.000.000")}&cierraAntesDe=${dia(120)}`],
    ["con cerradas", "/api/convocatorias?incluirCerradas=true"],
    ["pantalla del catálogo", "/convocatorias"],
  ];
  for (const [nombre, ruta] of casos) {
    const r = await medir(ruta);
    const cuantas = ruta.startsWith("/api") ? JSON.parse(r.texto).datos?.length : null;
    ok(r.status === 200 && r.mediana < LIMITE_MS && r.maximo < LIMITE_MS,
      `RNF-04: ${nombre} -> mediana ${Math.round(r.mediana)} ms, máximo ${Math.round(r.maximo)} ms${cuantas !== null ? `, ${cuantas} resultados` : ""}`);
  }
  const todas = JSON.parse((await medir("/api/convocatorias")).texto).datos ?? [];
  ok(todas.length === TOTAL && todas.filter((c) => c.nombre.includes(marca)).length === N,
    `con ${TOTAL} vigentes el listado no se trunca: trae ${todas.length} (${N} sembradas + ${TOTAL - N} reales)`);
} catch (err) {
  fallas++;
  console.error("FALLA inesperada:", err);
} finally {
  const { data: sembradas } = await svc.from("convocatorias").select("id").like("nombre", `${marca}%`);
  const ids = (sembradas ?? []).map((s) => s.id);
  for (let i = 0; i < ids.length; i += 200) await svc.from("convocatorias").delete().in("id", ids.slice(i, i + 200));
  if (categorias.length) await svc.from("categorias").delete().in("id", categorias);
  if (cuenta) await svc.auth.admin.deleteUser(cuenta);
  const { count } = await svc.from("convocatorias").select("id", { count: "exact", head: true }).like("nombre", `${marca}%`);
  console.log(`(quedan ${count} convocatorias de la prueba)`);
  console.log(fallas === 0 ? "\nTODO PASA" : `\n${fallas} FALLA(S)`);
  process.exit(fallas === 0 ? 0 : 1);
}
