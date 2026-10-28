// Prueba de las postulaciones por semana del tablero del panel (RF-42 ·
// lib/admin/semanas.ts · sesión 033). Código puro: no usa red ni Supabase.
//
//   node scripts/prueba-tablero-semanas.mjs
//
// Existe por el 500 que daba el panel de 7 p. m. a medianoche en Colombia: la
// semana actual terminaba a medianoche UTC y una postulación recién creada
// quedaba fuera de la lista.
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      import { pathToFileURL } from "node:url";
      import { existsSync } from "node:fs";
      const raiz = ${JSON.stringify(process.cwd().replace(/\\/g, "/"))};
      export async function resolve(especificador, contexto, siguiente) {
        if (especificador.startsWith("@/")) {
          const ruta = raiz + "/" + especificador.slice(2);
          for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(ruta + ext)) return { url: pathToFileURL(ruta + ext).href, shortCircuit: true };
        }
        return siguiente(especificador, contexto);
      }`)
);

const { postulacionesPorSemana, inicioDelPeriodo } = await import("../lib/admin/semanas.ts");

let fallas = 0;
const ok = (c, d) => { console.log(c ? "ok   " : "FALLA", d); if (!c) fallas++; };
const total = (r) => r.semanas.reduce((s, x) => s + x.total, 0);
const HOY = "2026-10-27";

// El caso del 500: 9 p. m. del 27 en Colombia son las 02:00 del 28 en UTC.
let r;
try {
  r = postulacionesPorSemana(["2026-10-28T02:00:00Z"], HOY);
  ok(r.semanas[11].total === 1, "postulación de las 9 p. m. en Colombia (02:00 UTC del día siguiente) cuenta en la semana actual, sin error");
} catch (e) {
  ok(false, `postulación de las 9 p. m. en Colombia -> lanzó ${e.message}`);
}

r = postulacionesPorSemana(["2026-10-27T04:59:00Z"], HOY);
ok(r.semanas[11].total === 1, "11:59 p. m. del 26 en Colombia es el día 26: sigue en la semana actual (del 21 al 27)");
r = postulacionesPorSemana(["2026-10-21T05:00:00Z"], HOY);
ok(r.semanas[11].total === 1, "medianoche del 21 en Colombia: primer día de la semana actual");
r = postulacionesPorSemana(["2026-10-21T04:59:59Z"], HOY);
ok(r.semanas[10].total === 1, "un segundo antes (20 en Colombia): semana anterior");

r = postulacionesPorSemana(["2026-11-05T15:00:00Z"], HOY);
ok(r.semanas[11].total === 1 && r.totalTrimestreAnterior === 0, "una fecha posterior a hoy (desfase de reloj) cuenta en la semana actual, nunca fuera de la lista");

r = postulacionesPorSemana(["2026-08-05T15:00:00Z", "2026-08-04T15:00:00Z", "2026-07-01T15:00:00Z", "2025-01-01T15:00:00Z"], HOY);
ok(r.semanas[0].total === 1 && total(r) === 1 && r.totalTrimestreAnterior === 2, "el 5 de agosto abre la primera semana; el 4 y el 1 de julio van al trimestre anterior; las más viejas no cuentan");

r = postulacionesPorSemana([], HOY);
ok(r.semanas.length === 12 && r.semanas[11].inicio === "2026-10-21" && r.semanas[0].inicio === "2026-08-05",
  `12 semanas, la actual empieza el 21 y la primera el 5 de agosto (${r.semanas[0].inicio} … ${r.semanas[11].inicio})`);
ok(r.semanas.every((s, i) => i === 0 || Date.parse(s.inicio) - Date.parse(r.semanas[i - 1].inicio) === 7 * 86400000), "las semanas van de 7 en 7 días");

// Cada hora de un día entero: ninguna lanza ni se pierde.
const horas = Array.from({ length: 24 }, (_, h) => new Date(Date.parse("2026-10-27T05:00:00Z") + h * 3600000).toISOString());
try {
  r = postulacionesPorSemana(horas, HOY);
  ok(r.semanas[11].total === 24, "las 24 horas del 27 en Colombia caen en la semana actual");
} catch (e) {
  ok(false, `las 24 horas del día -> lanzó ${e.message}`);
}

ok(inicioDelPeriodo(HOY) === "2026-05-13T05:00:00.000Z", `el periodo pedido empieza a medianoche de Colombia, 24 semanas atrás (${inicioDelPeriodo(HOY)})`);

console.log(fallas ? `\n${fallas} FALLAS` : "\nTodo en verde.");
process.exit(fallas ? 1 : 0);
