import "server-only";
import { cache } from "react";
import { forbidden, notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { ipDeCabeceras, registrarAccesoDenegado } from "./autorizacion/eventos";
import { crearClienteServidor } from "./supabase/servidor";
import type { DatosSesion, EstadoPerfilConsultor, ModalidadSuscripcion, EstadoSuscripcion, RolUsuario } from "./types";

/**
 * Lee en el servidor el usuario autenticado, su perfil, su suscripción con el
 * plan y, si es consultor, su perfil de consultor. Todo pasa por RLS con la
 * sesión del propio usuario. Devuelve null si no hay sesión.
 * `cache` evita repetir las consultas entre layout y páginas de una petición.
 */
export const obtenerSesion = cache(async (): Promise<DatosSesion | null> => {
  const supabase = await crearClienteServidor();

  // getUser valida la sesión contra el servidor de Auth, no solo la cookie.
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) return null;

  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, nombre_empresa, es_propietario")
    .eq("id", usuario.user.id)
    .maybeSingle();
  if (!perfil) return null;
  // Un administrador sin vigencia (revocado o con la invitación vencida) no
  // tiene sesión válida en ninguna parte (docs/05 §9.12, RF-87).
  const { data: rolEfectivo } = await supabase.rpc("rol_efectivo");
  if (rolEfectivo !== perfil.rol) return null;

  const rol = perfil.rol as RolUsuario;

  const { data: sus } = await supabase
    .from("suscripciones")
    .select(
      "id, plan_id, modalidad, estado, fecha_inicio, fecha_vencimiento, creditos_usados_periodo, creditos_extra, periodo_creditos_inicio, planes (id, nombre, rol, precio_mensual, precio_anual, creditos_ia_mensuales, es_trial)"
    )
    .eq("usuario_id", perfil.id)
    .order("fecha_vencimiento", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Sin sitio_web ni cv_path: esas columnas no se leen directamente (docs/05 §9.11 punto 4).
  const { data: cons } =
    rol === "consultor"
      ? await supabase
          .from("consultor_perfiles")
          .select("id, nombre_profesional, descripcion, estado_perfil, motivo_rechazo, es_equipo_interno, rating_promedio, total_encargos_completados")
          .eq("id", perfil.id)
          .maybeSingle()
      : { data: null };

  const planFila = sus?.planes as unknown as {
    id: string;
    nombre: string;
    rol: "empresa" | "consultor";
    precio_mensual: number;
    precio_anual: number;
    creditos_ia_mensuales: number;
    es_trial: boolean;
  } | null;

  return {
    sesion: {
      usuarioId: perfil.id,
      correo: usuario.user.email ?? "",
      nombre: perfil.nombre ?? usuario.user.email ?? "",
      nombreEmpresa: perfil.nombre_empresa,
      rol,
      aal: nivel?.currentLevel === "aal2" ? "aal2" : "aal1",
      esPropietario: rol === "administrador" && perfil.es_propietario === true,
    },
    suscripcion: sus
      ? {
          id: sus.id,
          usuarioId: perfil.id,
          planId: sus.plan_id,
          modalidad: sus.modalidad as ModalidadSuscripcion,
          estado: sus.estado as EstadoSuscripcion,
          fechaInicio: sus.fecha_inicio,
          fechaVencimiento: sus.fecha_vencimiento,
          creditosUsadosPeriodo: sus.creditos_usados_periodo,
          creditosExtra: sus.creditos_extra,
          periodoCreditosInicio: sus.periodo_creditos_inicio,
        }
      : null,
    plan: planFila
      ? {
          id: planFila.id,
          nombre: planFila.nombre,
          rol: planFila.rol,
          precioMensual: Number(planFila.precio_mensual),
          precioAnual: Number(planFila.precio_anual),
          creditosIaMensuales: planFila.creditos_ia_mensuales,
          esTrial: planFila.es_trial,
        }
      : null,
    consultor: cons
      ? {
          id: cons.id,
          nombreProfesional: cons.nombre_profesional ?? "",
          descripcion: cons.descripcion ?? "",
          fotoUrl: "",
          sitioWeb: "",
          redes: [],
          especialidades: [],
          portafolio: [],
          cvNombre: "",
          estadoPerfil: cons.estado_perfil as EstadoPerfilConsultor,
          motivoRechazo: cons.motivo_rechazo ?? undefined,
          esEquipoInterno: cons.es_equipo_interno,
          ratingPromedio: Number(cons.rating_promedio),
          totalEncargosCompletados: cons.total_encargos_completados,
          correo: usuario.user.email ?? "",
        }
      : null,
  };
});

/**
 * Segunda barrera de RNF-30, para layouts y páginas: repite en el servidor lo
 * que `proxy.ts` ya aplicó con la matriz rol × ruta. Si el proxy se saltara
 * (una ruta mal declarada, un cambio de matcher), la página sigue protegida.
 *   · sin sesión → /login, o 404 si la sección está oculta (RF-85);
 *   · rol no admitido → 403, o 404 si está oculta, y evento `acceso_denegado`.
 */
export async function exigirRol(
  roles: RolUsuario[],
  opciones: { ruta: string; oculta?: boolean }
): Promise<DatosSesion> {
  const datos = await obtenerSesion();
  const admitido = datos && roles.includes(datos.sesion.rol);

  if (!admitido) {
    if (datos || opciones.oculta) {
      await registrarAccesoDenegado({
        usuarioId: datos?.sesion.usuarioId ?? null,
        ruta: opciones.ruta,
        ip: ipDeCabeceras(await headers()),
        detalle: `Rol ${datos?.sesion.rol ?? "sin sesión"} no admitido (layout)`,
      });
    }
    if (opciones.oculta) notFound();
    if (!datos) redirect("/login");
    forbidden();
  }
  return datos;
}

/**
 * Segunda barrera de RF-85 y RNF-28 para los endpoints del panel: administrador
 * vigente con segundo factor verificado. Devuelve null y registra
 * `acceso_denegado` en cualquier otro caso; quien llama responde 404.
 */
export async function sesionDeAdministrador(ruta: string): Promise<DatosSesion | null> {
  const datos = await obtenerSesion();
  if (datos?.sesion.rol === "administrador" && datos.sesion.aal === "aal2") return datos;
  await registrarAccesoDenegado({
    usuarioId: datos?.sesion.usuarioId ?? null,
    ruta,
    ip: ipDeCabeceras(await headers()),
    detalle: "No es administrador con MFA (segunda barrera)",
  });
  return null;
}

/**
 * Segunda barrera de RF-86 para la gestión de administradores: sesión del
 * Propietario vigente con segundo factor verificado. Devuelve null y registra
 * `acceso_denegado` en cualquier otro caso; quien llama responde 404.
 */
export async function sesionDePropietario(ruta: string): Promise<DatosSesion | null> {
  const datos = await obtenerSesion();
  if (datos?.sesion.rol === "administrador" && datos.sesion.aal === "aal2" && datos.sesion.esPropietario) {
    return datos;
  }
  await registrarAccesoDenegado({
    usuarioId: datos?.sesion.usuarioId ?? null,
    ruta,
    ip: ipDeCabeceras(await headers()),
    detalle: "No es el Propietario (segunda barrera)",
  });
  return null;
}

/** Para páginas: 404 si la sesión no es del Propietario (RF-85, RF-86). */
export async function exigirPropietario(ruta: string): Promise<DatosSesion> {
  const datos = await sesionDePropietario(ruta);
  if (!datos) notFound();
  return datos;
}
