import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Límite de tasa (RF-66, RNF-27, CU-40 · docs/04 §8.3, docs/05 §9.31).
 *
 * Ventana fija por sujeto (correo, IP o usuario): `INCR` y `EXPIRE` en una sola
 * llamada `pipeline` a la API REST de Upstash. Al pasarse del máximo, el sujeto
 * queda bloqueado hasta que termina la ventana, y el primer exceso se registra
 * en `eventos_seguridad` con la clave del contador, para que el administrador
 * lo libere (RF-67). **Si Upstash no responde o falta la configuración, se
 * rechaza (fail-closed, RNF-33)**: el control nunca se vuelve opcional.
 *
 * Solo en lo delicado (decisión del Product Owner, sesión 030): así alcanza el
 * plan gratuito de Upstash.
 */

export type NombreLimite = "login" | "registro" | "recuperacion" | "ia";

type Sujeto = "correo" | "cuenta" | "ip" | "usuario";

const LIMITES: Record<NombreLimite, { ventanaSeg: number; maximos: Partial<Record<Sujeto, number>> }> = {
  // correo = correo + IP (nadie bloquea a otro desde otra máquina); cuenta = el
  // correo solo, más alto, contra probar una misma cuenta desde muchas IP.
  login: { ventanaSeg: 600, maximos: { correo: 8, cuenta: 30, ip: 50 } },
  registro: { ventanaSeg: 3600, maximos: { ip: 10 } },
  recuperacion: { ventanaSeg: 3600, maximos: { correo: 3, ip: 10 } },
  ia: { ventanaSeg: 600, maximos: { usuario: 30 } },
};

const PLAZO_MS = 2_000;

export type Veredicto =
  | { ok: true }
  | { ok: false; motivo: "limite"; reintentarEnSeg: number }
  | { ok: false; motivo: "no_disponible" };

type Identidad = { correo?: string | null; cuenta?: string | null; ip?: string | null; usuarioId?: string | null };

function valorDe(sujeto: Sujeto, id: Identidad): string | null {
  const v = sujeto === "correo" ? id.correo : sujeto === "cuenta" ? id.cuenta : sujeto === "ip" ? id.ip : id.usuarioId;
  return v ? v.trim().toLowerCase().slice(0, 200) : null;
}

async function upstash(comandos: (string | number)[][]): Promise<unknown[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Falta la configuración de Upstash");
  const r = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(comandos),
    signal: AbortSignal.timeout(PLAZO_MS),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Upstash respondió ${r.status}`);
  const json = (await r.json()) as { result?: unknown; error?: string }[];
  if (!Array.isArray(json) || json.some((x) => x.error)) throw new Error("Upstash devolvió un error");
  return json.map((x) => x.result);
}

function servicio() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cuenta un intento de `nombre` para la identidad dada y dice si puede seguir.
 * `ruta` y `usuarioId` solo van al registro del bloqueo.
 */
export async function comprobarLimite(nombre: NombreLimite, identidad: Identidad, ruta: string): Promise<Veredicto> {
  const { ventanaSeg, maximos } = LIMITES[nombre];
  const ahora = Math.floor(Date.now() / 1000);
  const ventana = Math.floor(ahora / ventanaSeg);
  const finVentana = (ventana + 1) * ventanaSeg;

  const sujetos = (Object.entries(maximos) as [Sujeto, number][])
    .map(([sujeto, maximo]) => ({ sujeto, maximo, valor: valorDe(sujeto, identidad) }))
    .filter((s): s is { sujeto: Sujeto; maximo: number; valor: string } => s.valor !== null)
    .map((s) => ({ ...s, clave: `lt:${nombre}:${s.sujeto}:${s.valor}:${ventana}` }));
  if (sujetos.length === 0) return { ok: true };

  let cuentas: number[];
  try {
    const resultados = await upstash(sujetos.flatMap((s) => [["INCR", s.clave], ["EXPIRE", s.clave, ventanaSeg + 60]]));
    cuentas = sujetos.map((_, i) => Number(resultados[i * 2]));
    if (cuentas.some((c) => !Number.isFinite(c))) throw new Error("Respuesta de Upstash inesperada");
  } catch (e) {
    // RNF-33: el incidente queda en el log del servidor y la operación se rechaza.
    console.error(`Límite de tasa: Upstash no respondió (${nombre}); se rechaza`, e instanceof Error ? e.message : e);
    return { ok: false, motivo: "no_disponible" };
  }

  const excedidos = sujetos.filter((s, i) => cuentas[i] > s.maximo);
  if (excedidos.length === 0) return { ok: true };

  // Solo el primer exceso de la ventana deja el evento: los siguientes ya están bloqueados.
  const nuevos = excedidos.filter((s) => cuentas[sujetos.indexOf(s)] === s.maximo + 1);
  if (nuevos.length > 0) {
    const { error } = await servicio()
      .from("eventos_seguridad")
      .insert(
        nuevos.map((s) => ({
          tipo: "limite_tasa",
          usuario_id: identidad.usuarioId ?? null,
          ip: identidad.ip ?? null,
          ruta: ruta.slice(0, 500),
          detalle: `Más de ${s.maximo} intentos de ${nombre} por ${s.sujeto} en ${Math.round(ventanaSeg / 60)} minutos`,
          bloqueado_hasta: new Date(finVentana * 1000).toISOString(),
          clave_limite: s.clave,
        }))
      );
    if (error) console.error("Límite de tasa: no se pudo registrar el bloqueo", error.message);
  }
  return { ok: false, motivo: "limite", reintentarEnSeg: Math.max(1, finVentana - ahora) };
}

/** Texto para el usuario según el veredicto (formularios y endpoints). */
export function mensajeLimite(v: Exclude<Veredicto, { ok: true }>): string {
  if (v.motivo === "no_disponible") {
    return "No podemos procesar tu solicitud en este momento. Intenta de nuevo en unos minutos.";
  }
  const minutos = Math.ceil(v.reintentarEnSeg / 60);
  return `Hiciste demasiados intentos seguidos. Intenta de nuevo en ${minutos === 1 ? "1 minuto" : `${minutos} minutos`}.`;
}

/** RF-67 · Borra el contador de un bloqueo que el administrador liberó. */
export async function borrarContador(clave: string): Promise<boolean> {
  try {
    await upstash([["DEL", clave]]);
    return true;
  } catch (e) {
    console.error("Límite de tasa: no se pudo borrar el contador", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * RF-66 · Para los endpoints de IA: null si puede seguir; si no, la respuesta
 * 429 con `Retry-After` o 503 si Upstash no responde (RNF-33). Se llama antes
 * de reservar crédito o de llamar al proveedor.
 */
export async function limitarIA(usuarioId: string, ruta: string): Promise<NextResponse | null> {
  const v = await comprobarLimite("ia", { usuarioId }, ruta);
  if (v.ok) return null;
  if (v.motivo === "no_disponible") return NextResponse.json({ error: mensajeLimite(v) }, { status: 503 });
  return NextResponse.json({ error: mensajeLimite(v) }, { status: 429, headers: { "Retry-After": String(v.reintentarEnSeg) } });
}
