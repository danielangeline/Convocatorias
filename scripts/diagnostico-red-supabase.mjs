// Diagnóstico de red hacia Supabase (incidente 2026-09-22, cerrado en la sesión 016).
//
//   node --env-file=.env.local scripts/diagnostico-red-supabase.mjs
//
// Manda la misma petición POST, sin sesión y a una función que no existe con ese
// cuerpo (la API responde 404 al instante, sin tocar la base ni crear datos),
// 30 veces por cada tamaño de relleno, de 15 en 15. Cada petición abre su propio
// socket, así que no interviene el pool keep-alive de nadie.
//
// El fallo depende del tamaño EXACTO al byte: no cambies la forma del cuerpo. Con
// `p_id: "x"` y rellenos de 1 450 y 1 460, el 22-sep morían con ECONNRESET tras
// ~15 s entre 1 y 5 de cada 30, y ninguna con 1 000; con `p_id` 10 caracteres más
// largo, pasaban todas. Es la firma del cuelgue al guardar convocatorias. Si aquí sale limpio
// pero la suite sigue fallando, el diagnóstico de docs/incidentes/ era incorrecto.
import https from "node:https";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REPETICIONES = 30, TANDA = 15, TAMANOS = [1000, 1450, 1460];

const una = (n) => new Promise((resolver) => {
  const cuerpo = JSON.stringify({ p_id: "x", relleno: "a".repeat(n) });
  const t0 = Date.now();
  const peticion = https.request(`${URL_}/rest/v1/rpc/guardar_convocatoria`, {
    method: "POST", agent: false, timeout: 30000,
    headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": "application/json", "content-length": Buffer.byteLength(cuerpo) },
  }, (r) => { r.resume(); r.on("end", () => resolver({ n, ok: Date.now() - t0 < 3000, detalle: r.statusCode, ms: Date.now() - t0 })); });
  peticion.on("timeout", () => peticion.destroy(Object.assign(new Error("sin respuesta en 30 s"), { code: "TIMEOUT" })));
  peticion.on("error", (e) => resolver({ n, ok: false, detalle: e.code ?? e.message, ms: Date.now() - t0 }));
  peticion.end(cuerpo);
});

let malas = 0;
for (const n of TAMANOS) {
  const resultados = [];
  for (let i = 0; i < REPETICIONES; i += TANDA) resultados.push(...(await Promise.all(Array.from({ length: TANDA }, () => una(n)))));
  const fallidas = resultados.filter((r) => !r.ok);
  malas += fallidas.length;
  console.log(`${String(n).padStart(5)} bytes: ${REPETICIONES - fallidas.length}/${REPETICIONES} bien` +
    (fallidas.length ? ` · fallaron: ${fallidas.map((r) => `${r.detalle} en ${r.ms} ms`).join(", ")}` : ""));
}
console.log(malas ? "LA RED PIERDE PETICIONES: ver docs/incidentes/2026-09-22-cuelgue-al-guardar-convocatoria.md" : "RED LIMPIA");
process.exitCode = malas ? 1 : 0;
