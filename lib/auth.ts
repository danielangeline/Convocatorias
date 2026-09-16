import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
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
    .select("id, nombre, rol, nombre_empresa")
    .eq("id", usuario.user.id)
    .maybeSingle();
  if (!perfil) return null;

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

/** Exige sesión en el servidor: sin ella, redirige a /login. */
export async function exigirSesion(): Promise<DatosSesion> {
  const datos = await obtenerSesion();
  if (!datos) redirect("/login");
  return datos;
}
