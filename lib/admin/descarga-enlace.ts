import "server-only";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import type { LookupFunction } from "node:net";

/**
 * Descarga de un documento desde un enlace que escribió un administrador
 * (RF-118, RNF-37). El enlace lo escribe una persona de confianza, pero el
 * servidor no debe servir para pedir direcciones internas (la red de Vercel,
 * los metadatos de la nube, `localhost`), así que:
 *
 *   · solo `http`/`https` en los puertos 80 y 443;
 *   · la IP se comprueba **en la conexión**, con un `lookup` propio: un nombre
 *     que resuelve a una IP privada no se conecta, y tampoco uno que cambie de
 *     IP entre la comprobación y la conexión (no hay dos resoluciones);
 *   · cada redirección vuelve a pasar por todo, hasta 3;
 *   · se corta a los 30 s y a los 20 MB;
 *   · el tipo se reconoce por el contenido (PDF, Word, Excel o ZIP), no por lo
 *     que diga el portal: una página de inicio de sesión con nombre `.pdf` no pasa.
 */

const TIEMPO_MAXIMO_MS = 30_000;
const REDIRECCIONES_MAXIMAS = 3;

export type Descarga = { contenido: Buffer; extension: string; nombre: string };
export type ResultadoDescarga = { ok: true; descarga: Descarga } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Direcciones que no se piden nunca
// ---------------------------------------------------------------------------

function ipv4Privada(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number);
  return (
    a === 0 || // «esta red»
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // enlace local y metadatos de la nube
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // multidifusión y reservadas
  );
}

/** IPv4 o IPv6 que no es una dirección pública de internet. */
export function ipPrivada(ip: string): boolean {
  if (net.isIPv4(ip)) return ipv4Privada(ip);
  if (!net.isIPv6(ip)) return true;
  const v6 = ip.toLowerCase();
  // IPv4 dentro de IPv6 (::ffff:10.0.0.1, 64:ff9b::10.0.0.1 o sus formas hexadecimales).
  const mapeada = /^(?:::ffff:|64:ff9b::)(.+)$/.exec(v6);
  if (mapeada) {
    const resto = mapeada[1];
    if (net.isIPv4(resto)) return ipv4Privada(resto);
    const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(resto);
    if (hex) {
      const alto = parseInt(hex[1], 16), bajo = parseInt(hex[2], 16);
      return ipv4Privada(`${alto >> 8}.${alto & 255}.${bajo >> 8}.${bajo & 255}`);
    }
    return true;
  }
  return (
    v6 === "::" ||
    v6 === "::1" ||
    /^f[cd]/.test(v6) || // únicas locales fc00::/7
    /^fe[89ab]/.test(v6) || // enlace local fe80::/10
    v6.startsWith("ff") || // multidifusión
    v6.startsWith("2001:db8") || // documentación
    v6.startsWith("100::") ||
    v6.startsWith("::") // otras formas compatibles con IPv4, obsoletas
  );
}

class Rechazo extends Error {}

/** Resolución de nombres que se niega a entregar una IP privada a la conexión. */
const lookupSeguro: LookupFunction = (hostname, opciones, listo) => {
  dns.lookup(hostname, { all: true, family: opciones.family ?? 0 }, (error, direcciones) => {
    if (error) return listo(error, "", 0);
    if (direcciones.length === 0 || direcciones.some((d) => ipPrivada(d.address))) {
      return listo(new Rechazo("privada"), "", 0);
    }
    if (opciones.all) return (listo as unknown as (e: null, d: dns.LookupAddress[]) => void)(null, direcciones);
    listo(null, direcciones[0].address, direcciones[0].family);
  });
};

/** Comprueba lo que se puede comprobar antes de conectar. */
function urlPermitida(texto: string): URL | string {
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return "no es un enlace válido.";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "solo se descargan enlaces http o https.";
  if (url.username || url.password) return "el enlace no puede llevar usuario ni contraseña.";
  if (url.port && url.port !== "80" && url.port !== "443") return "solo se descargan enlaces en los puertos habituales (80 y 443).";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // Una IP escrita en el enlace no pasa por `lookup`: se comprueba aquí.
  if (net.isIP(host) ? ipPrivada(host) : host === "localhost" || host.endsWith(".localhost") || !host.includes(".")) {
    return "apunta a una dirección interna.";
  }
  return url;
}

// ---------------------------------------------------------------------------
// Tipo por contenido
// ---------------------------------------------------------------------------

const empiezaCon = (b: Buffer, firma: number[]) => firma.every((byte, i) => b[i] === byte);

/** PDF, Word, Excel o ZIP según sus primeros bytes; null si no es ninguno. */
function extensionPorContenido(contenido: Buffer, pista: string): string | null {
  if (contenido.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (empiezaCon(contenido, [0x50, 0x4b, 0x03, 0x04])) {
    // Los nombres de las entradas de un ZIP van sin comprimir.
    const muestra = contenido.toString("latin1");
    if (muestra.includes("word/")) return "docx";
    if (muestra.includes("xl/")) return "xlsx";
    return "zip";
  }
  // Formato binario de Office: Word y Excel comparten la cabecera; decide la pista.
  if (empiezaCon(contenido, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return /xls|excel/.test(pista) ? "xls" : "doc";
  }
  return null;
}

/** Nombre legible: el de `Content-Disposition` o el final de la ruta, sin extensión. */
function nombreDe(url: URL, disposicion: string | undefined): string {
  let nombre = "";
  const extendido = disposicion && /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(disposicion);
  const simple = disposicion && /filename\s*=\s*"?([^";]+)"?/.exec(disposicion);
  try {
    nombre = extendido ? decodeURIComponent(extendido[1]) : simple ? simple[1] : decodeURIComponent(url.pathname.split("/").pop() ?? "");
  } catch {
    nombre = url.pathname.split("/").pop() ?? "";
  }
  nombre = nombre.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[\u0000-\u001f]/g, "").trim();
  return (nombre || "Documento descargado").slice(0, 200);
}

// ---------------------------------------------------------------------------
// Descarga
// ---------------------------------------------------------------------------

function pedir(url: URL, limite: number, fin: number): Promise<
  | { tipo: "redireccion"; destino: string }
  | { tipo: "archivo"; contenido: Buffer; contentType: string; disposicion?: string }
> {
  return new Promise((resolverPromesa, rechazarPromesa) => {
    const modulo = url.protocol === "https:" ? https : http;
    const restante = fin - Date.now();
    if (restante <= 0) return rechazarPromesa(new Rechazo("tiempo"));
    // Plazo total: `timeout` de Node solo mide el tiempo sin recibir datos, y un
    // portal que manda un byte cada pocos segundos lo burlaría.
    const plazo = setTimeout(() => {
      peticion.destroy();
      rechazarPromesa(new Rechazo("tiempo"));
    }, restante);
    const resolver: typeof resolverPromesa = (valor) => {
      clearTimeout(plazo);
      resolverPromesa(valor);
    };
    const rechazar = (motivo: unknown) => {
      clearTimeout(plazo);
      rechazarPromesa(motivo);
    };
    const peticion = modulo.get(
      url,
      {
        lookup: lookupSeguro,
        timeout: restante,
        headers: { "user-agent": "Mozilla/5.0 (compatible; GestionConvocatorias/1.0)", accept: "*/*" },
      },
      (respuesta) => {
        const estado = respuesta.statusCode ?? 0;
        if (estado >= 300 && estado < 400 && respuesta.headers.location) {
          respuesta.resume();
          return resolver({ tipo: "redireccion", destino: new URL(respuesta.headers.location, url).toString() });
        }
        if (estado !== 200) {
          respuesta.resume();
          return rechazar(new Rechazo(`estado ${estado}`));
        }
        const declarado = Number(respuesta.headers["content-length"]);
        if (Number.isFinite(declarado) && declarado > limite) {
          respuesta.destroy();
          return rechazar(new Rechazo("grande"));
        }
        const partes: Buffer[] = [];
        let total = 0;
        respuesta.on("data", (parte: Buffer) => {
          total += parte.length;
          if (total > limite) {
            respuesta.destroy();
            peticion.destroy();
            rechazar(new Rechazo("grande"));
          } else partes.push(parte);
        });
        respuesta.on("end", () =>
          resolver({
            tipo: "archivo",
            contenido: Buffer.concat(partes),
            contentType: String(respuesta.headers["content-type"] ?? ""),
            disposicion: respuesta.headers["content-disposition"],
          })
        );
        respuesta.on("error", rechazar);
        // Si se corta antes de terminar (plazo o tamaño), la promesa ya se rechazó; esto cubre un corte del portal.
        respuesta.on("aborted", () => rechazar(new Rechazo("cortada")));
      }
    );
    peticion.on("timeout", () => peticion.destroy(new Rechazo("tiempo")));
    peticion.on("error", rechazar);
  });
}

const MOTIVOS: Record<string, string> = {
  privada: "apunta a una dirección interna.",
  tiempo: "el portal tardó más de 30 segundos en responder.",
  grande: "el documento pasa de 20 MB.",
  cortada: "el portal cortó la descarga antes de terminar.",
};

export async function descargarDocumento(enlace: string, limite: number): Promise<ResultadoDescarga> {
  const fin = Date.now() + TIEMPO_MAXIMO_MS;
  let actual = enlace;
  for (let saltos = 0; saltos <= REDIRECCIONES_MAXIMAS; saltos++) {
    const url = urlPermitida(actual);
    if (typeof url === "string") return { ok: false, error: `No se descargó: ${url}` };
    try {
      const r = await pedir(url, limite, fin);
      if (r.tipo === "redireccion") {
        actual = r.destino;
        continue;
      }
      const pista = `${r.contentType} ${url.pathname}`.toLowerCase();
      const extension = extensionPorContenido(r.contenido, pista);
      if (!extension) {
        return {
          ok: false,
          error: "No se descargó: el enlace no entrega un PDF, Word, Excel ni ZIP (puede ser una página o pedir iniciar sesión). Descárgalo y súbelo a mano.",
        };
      }
      return { ok: true, descarga: { contenido: r.contenido, extension, nombre: nombreDe(url, r.disposicion) } };
    } catch (error) {
      if (error instanceof Rechazo) {
        const estado = /^estado (\d+)$/.exec(error.message);
        return {
          ok: false,
          error: estado
            ? `No se descargó: el portal respondió con el código ${estado[1]}. Revisa el enlace o súbelo a mano.`
            : `No se descargó: ${MOTIVOS[error.message] ?? "el portal no respondió."}`,
        };
      }
      return { ok: false, error: "No se descargó: no pudimos conectar con el portal. Revisa el enlace o súbelo a mano." };
    }
  }
  return { ok: false, error: "No se descargó: el enlace redirige demasiadas veces." };
}
