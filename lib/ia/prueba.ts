import "server-only";
import { ErrorIA, type PeticionRedaccion, type ProveedorIA, type ResultadoRedaccion } from "./tipos";

/**
 * Proveedor de prueba (RNF-22): responde sin llamar a nadie, para las pruebas
 * automáticas y para trabajar sin saldo en el proveedor. Solo se activa con
 * `IA_PROVEEDOR=prueba` y nunca en producción (`lib/ia/index.ts`).
 *
 * No redacta: devuelve las secciones que pide el contexto con un marcador
 * [COMPLETAR: …] cada una, así que tampoco inventa nada (RNF-23). Si el
 * contexto contiene `FALLA_IA_PRUEBA`, falla como un proveedor caído, para
 * probar que una generación fallida no cobra (RN-17).
 */
export const proveedorPrueba: ProveedorIA = {
  nombre: "prueba",
  async redactar(p: PeticionRedaccion): Promise<ResultadoRedaccion> {
    const demora = Number(process.env.IA_PRUEBA_DEMORA_MS ?? 300);
    await new Promise((r) => setTimeout(r, Math.min(demora, p.plazoMs)));
    const tokensEntrada = Math.ceil((p.instrucciones.length + p.mensaje.length) / 4);
    if (demora >= p.plazoMs) throw new ErrorIA("El proveedor de IA no respondió a tiempo", "plazo");
    if (p.mensaje.includes("FALLA_IA_PRUEBA")) {
      throw new ErrorIA("Fallo simulado del proveedor de prueba", "proveedor", tokensEntrada, 0);
    }

    const ajuste = p.mensaje.match(/<indicacion_del_usuario>\n?([\s\S]*?)\n?<\/indicacion_del_usuario>/)?.[1]?.trim();
    const actual = p.mensaje.match(/<documento_actual>\n?([\s\S]*?)\n?<\/documento_actual>/)?.[1];
    if (ajuste && actual) {
      const secciones = actual
        .split(/^## /m)
        .filter((b) => b.trim())
        .map((b) => {
          const [titulo, ...resto] = b.split("\n");
          return { titulo: titulo.trim(), contenido: `${resto.join("\n").trim()}\n\n(Ajuste de prueba: ${ajuste})` };
        });
      return { titulo: "Documento ajustado", secciones, tokensEntrada, tokensSalida: 200 };
    }

    const estructura = p.mensaje.match(/<estructura>\n?([\s\S]*?)\n?<\/estructura>/)?.[1] ?? "";
    const titulos = estructura
      .split("\n")
      .map((l) => l.replace(/^\s*(\d+\.|-)\s*/, "").trim())
      .filter(Boolean);
    const nombre = p.mensaje.match(/^Nombre del proyecto: (.+)$/m)?.[1] ?? "el proyecto";
    return {
      titulo: `Documento base de ${nombre}`,
      secciones: (titulos.length ? titulos : ["Resumen ejecutivo"]).map((t) => ({
        titulo: t,
        contenido: `[COMPLETAR: contenido de la sección "${t}"]`,
      })),
      tokensEntrada,
      tokensSalida: 150,
    };
  },
};
