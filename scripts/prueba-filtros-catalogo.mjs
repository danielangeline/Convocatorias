// Prueba de los 20 filtros del catálogo y del orden (RF-12, RF-94, RN-02, RN-34 ·
// lib/catalogo-filtros.ts y lib/departamentos.ts). Código puro: no usa red ni Supabase.
//
//   node scripts/prueba-filtros-catalogo.mjs
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      import { pathToFileURL } from "node:url";
      import { existsSync } from "node:fs";
      const raiz = ${JSON.stringify(process.cwd().replace(/\\/g, "/"))};
      export async function resolve(especificador, contexto, siguiente) {
        if (especificador === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
        if (especificador.startsWith("@/")) {
          const ruta = raiz + "/" + especificador.slice(2);
          for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(ruta + ext)) return { url: pathToFileURL(ruta + ext).href, shortCircuit: true };
        }
        return siguiente(especificador, contexto);
      }`)
);

const { filtrarCatalogo, ordenarCatalogo, conteoPorCategoria, ORDENES } = await import("../lib/catalogo-filtros.ts");
const { DEPARTAMENTOS, REGIONES } = await import("../lib/departamentos.ts");

let fallas = 0;
const ok = (c, d) => { console.log(c ? "ok   " : "FALLA", d); if (!c) fallas++; };
const ids = (l) => l.map((c) => c.id).join(",");

const HOY = "2026-10-21";
const doc = (tipo) => ({ id: "d", tipo, nombre: "n", archivo: "a.pdf", pesoKb: 1 });
const req = (tipo, obligatorio = true) => ({ id: "r", descripcion: "x", tipo, obligatorio, orden: 1 });
const base = {
  descripcion: "", ubicacion: "", fechaApertura: null, estado: "publicada", categorias: [], documentos: [], requisitos: [],
  montoMin: null, montoMax: null, coberturaNacional: false, departamentos: [],
};
const A = { ...base, id: "A", nombre: "Calidad automotriz", entidadConvocante: "iNNpulsa", departamentos: ["05", "11"], categorias: ["tp1", "s1", "e1"], fechaApertura: "2026-09-29", fechaCierre: "2026-11-04", documentos: [doc("TDR"), doc("anexo")], requisitos: [req("condicion"), req("documento"), req("condicion")] };
const B = { ...base, id: "B", nombre: "Regalías Córdoba", entidadConvocante: "Minciencias", departamentos: ["23"], categorias: ["tp2", "s2", "e2"], montoMin: 28e9, montoMax: 28e9, fechaApertura: "2026-09-25", fechaCierre: "2026-10-23", documentos: [doc("TDR")], requisitos: [req("documento"), req("documento"), req("condicion"), req("condicion"), req("condicion"), req("condicion")] };
const C = { ...base, id: "C", nombre: "Startups globales", entidadConvocante: "South Summit", coberturaNacional: true, categorias: ["tp3", "s1", "e3"], fechaCierre: "2027-01-12", documentos: [doc("terminos")], requisitos: [req("documento", false), req("condicion")] };
const D_ = { ...base, id: "D", nombre: "Fondo Pacífico", entidadConvocante: "Minciencias", departamentos: ["19", "76"], categorias: ["tp2"], montoMax: 14e9, fechaApertura: "2026-10-08", fechaCierre: "2026-11-03", documentos: [doc("formato")], requisitos: [req("condicion"), req("condicion")] };
const X = { ...base, id: "X", nombre: "Ya cerrada", entidadConvocante: "iNNpulsa", coberturaNacional: true, estado: "cerrada", fechaCierre: "2026-10-13", categorias: ["tp1"] };
const L = [A, B, C, D_, X];
const f = (filtros) => ids(filtrarCatalogo(L, filtros, HOY));

// --- Las regiones asignan cada departamento una sola vez.
const asignados = REGIONES.flatMap((r) => r.departamentos);
ok(asignados.length === DEPARTAMENTOS.length && new Set(asignados).size === DEPARTAMENTOS.length, "las regiones cubren los 33 departamentos, una vez cada uno");
ok(DEPARTAMENTOS.every((d) => asignados.includes(d.codigo)), "todo departamento tiene región");

// --- Los 20 criterios.
ok(f({ q: "automotriz" }) === "A", "(1) texto libre sin tildes: «automotriz»");
ok(f({ q: "regalias" }) === "B", "(1) texto libre: «regalias» encuentra «Regalías»");
ok(f({ tipoProyecto: ["tp2"] }) === "B,D", "(2) tipo de proyecto");
ok(f({ tipoProyecto: ["tp1", "tp3"] }) === "A,C,X", "(2) varias opciones del mismo grupo suman");
ok(f({ sector: ["s1"] }) === "A,C", "(3) sector");
ok(f({ tipoEntidad: ["e3"] }) === "C", "(4) quién puede postular");
ok(f({ tipoProyecto: ["tp1"], sector: ["s2"] }) === "", "grupos distintos se restringen entre sí");
ok(f({ entidad: "Minciencias" }) === "B,D", "(5) entidad convocante");
ok(f({ departamento: "05" }) === "A,C,X", "(6) departamento trae las nacionales (RN-34)");
ok(f({ departamento: "23" }) === "B,C,X", "(6) otro departamento");
ok(f({ region: "pacifica" }) === "C,D,X", "(7) región Pacífica: D y las nacionales");
ok(f({ region: "andina" }) === "A,C,X", "(7) región Andina: A (Antioquia/Bogotá) y las nacionales");
ok(f({ region: "caribe" }) === "B,C,X", "(7) región Caribe: B (Córdoba) y las nacionales");
ok(f({ alcance: "nacional" }) === "C,X", "(8) solo nacionales");
ok(f({ alcance: "territorial" }) === "A,B,D", "(8) solo territoriales");
ok(f({ montoHasta: 10e9 }) === "A,C,D,X", "(9) monto mínimo exigido hasta X (sin monto no se excluye)");
ok(f({ montoDesde: 20e9 }) === "B", "(10) apoya con al menos X");
ok(f({ montoDesde: 10e9 }) === "B,D", "(10) las que no informan monto máximo no pueden afirmarlo y salen");
ok(f({ monto: "con" }) === "B,D", "(11) con monto informado");
ok(f({ monto: "sin" }) === "A,C,X", "(11) sin monto informado");
ok(f({ cierraAntesDe: "2026-11-03" }) === "B,D,X", "(12) cierra antes de (incluye el día)");
ok(f({ cierraDesde: "2026-11-04" }) === "A,C", "(13) cierra desde (incluye el día)");
ok(f({ cierraEnDias: 7 }) === "B", "(14) cierra en 7 días: B (23-oct); X ya cerró y no cuenta");
ok(f({ cierraEnDias: 15 }) === "A,B,D", "(14) cierra en 15 días: hasta el 5-nov");
ok(f({ cierraEnDias: 90 }) === "A,B,C,D", "(14) cierra en 90 días: hasta el 19-ene-2027");
ok(f({ anioCierre: 2027 }) === "C", "(15) año de cierre 2027");
ok(f({ anioCierre: 2026 }) === "A,B,D,X", "(15) año de cierre 2026");
ok(f({ abreDesde: "2026-10-01" }) === "D", "(16) abre desde: sin apertura informada no entra");
ok(f({ tipoDoc: ["anexo"] }) === "A", "(17) tipo de documento: anexo");
ok(f({ tipoDoc: ["TDR", "formato"] }) === "A,B,D", "(17) varios tipos de documento suman");
ok(f({ exigeDocumentos: true }) === "A,B", "(18) exige documentos (un requisito opcional de documento no cuenta)");
ok(f({ maxRequisitos: 2 }) === "C,D,X", "(19) hasta 2 requisitos");
ok(f({ maxRequisitos: 3 }) === "A,C,D,X", "(19) hasta 3 requisitos");
ok(f({}) === "A,B,C,D,X", "sin filtros devuelve todo lo recibido");
ok(f({ departamento: "05", montoDesde: 1, cierraEnDias: 90 }) === "", "combinar tres filtros restringe: ninguna de Antioquia informa monto");
ok(f({ region: "andina", tipoDoc: ["TDR"], exigeDocumentos: true, cierraEnDias: 30 }) === "A", "combinar cuatro filtros: solo A los cumple");

// --- El horizonte de «cierra en N días» sigue a «hoy» (fin de mes y de año).
ok(ids(filtrarCatalogo([{ ...A, fechaCierre: "2027-01-02" }], { cierraEnDias: 7 }, "2026-12-30")) === "A", "cierraEnDias cruza el fin de año");
ok(ids(filtrarCatalogo([{ ...A, fechaCierre: "2026-12-31" }], { cierraEnDias: 7 }, "2026-12-30")) === "A", "cierra mañana: cuenta");
ok(ids(filtrarCatalogo([{ ...A, fechaCierre: "2026-12-30" }], { cierraEnDias: 7 }, "2026-12-30")) === "A", "cierra hoy: cuenta");
ok(ids(filtrarCatalogo([{ ...A, fechaCierre: "2026-12-29" }], { cierraEnDias: 7 }, "2026-12-30")) === "", "ya cerró ayer: no cuenta");

// --- Orden (RF-94): las vigentes siempre antes que las cerradas.
const o = (orden) => ids(ordenarCatalogo(L, orden));
ok(o("cierre_asc") === "B,D,A,C,X", "orden cierre más próximo");
ok(o("cierre_desc") === "C,A,D,B,X", "orden cierre más lejano; la cerrada sigue al final");
ok(o("monto_desc") === "B,D,A,C,X", "orden mayor monto; sin monto al final de su grupo");
ok(o("monto_asc") === "D,B,A,C,X", "orden menor monto; sin monto al final de su grupo");
ok(o("apertura_desc") === "D,A,B,C,X", "orden apertura más reciente; sin apertura al final");
ok(o("nombre") === "A,D,B,C,X", "orden por nombre (A-Z): Calidad, Fondo, Regalías, Startups; la cerrada al final");
ok(o("entidad") === "A,B,D,C,X", "orden por entidad: iNNpulsa, Minciencias (desempata por cierre), South Summit; la cerrada al final");
ok(o("requisitos_asc") === "D,C,A,B,X", "orden menos requisitos (empate C y D: gana el cierre más próximo)");
ok(ORDENES.length === 8, "ocho órdenes");
ok(ordenarCatalogo([], "nombre").length === 0, "ordenar una lista vacía");
const original = [...L];
ordenarCatalogo(L, "nombre");
ok(ids(L) === ids(original), "ordenar no modifica la lista recibida");

// --- Conteo por opción (RF-95).
const cuenta = conteoPorCategoria([A, B, C, D_]);
ok(cuenta.get("s1") === 2 && cuenta.get("tp2") === 2 && cuenta.get("e3") === 1 && cuenta.get("tp1") === 1 && !cuenta.has("zz"), "conteo por categoría: s1=2, tp2=2, e3=1, tp1=1");

console.log(fallas ? `\n${fallas} FALLAS` : "\nTodo en verde.");
process.exit(fallas ? 1 : 0);
