import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { registrarEventoSeguridad } from "@/lib/autorizacion/eventos";
import { crearClienteServicio, crearClienteServidor } from "@/lib/supabase/servidor";
import type {
  AdministradorListado,
  EstadoInvitacionAdmin,
  InvitacionAdminListado,
  ListadoAdministradores,
} from "@/lib/types";

/**
 * Gestión de administradores por el Propietario (CU-41, RF-86, RF-87,
 * docs/05 §9.12). Quien llama ya comprobó la sesión del Propietario
 * (`sesionDePropietario`); las reglas de cada acción las vuelven a aplicar las
 * funciones SQL, que solo ejecuta service_role. Aquí vive lo que no es SQL:
 * enviar el correo y borrar o bloquear la cuenta en Auth.
 */

export type Resultado<T = undefined> =
  | { ok: true; datos?: T; aviso?: string }
  | { ok: false; status: number; error: string };

export interface Contexto {
  propietarioId: string;
  ruta: string;
  ip: string | null;
  // Origen de la petición, para el enlace del correo.
  origen: string;
}

// El SQL rechaza con una clave estable en `hint` (docs/05 §9.12).
const RECHAZOS: Record<string, { status: number; error: string }> = {
  no_es_propietario: { status: 404, error: "No encontrado." },
  correo_invalido: { status: 400, error: "Escribe un correo válido." },
  invitacion_pendiente: {
    status: 409,
    error: "Ya hay una invitación pendiente para ese correo. Reenvíala o cancélala.",
  },
  correo_con_cuenta: {
    status: 409,
    error: "Ese correo ya tiene una cuenta en la plataforma. Un administrador necesita una cuenta dedicada con otro correo.",
  },
  invitacion_no_existe: { status: 404, error: "La invitación no existe." },
  invitacion_no_cancelable: { status: 409, error: "Esa invitación ya no se puede cancelar." },
  revocarse_a_si_mismo: { status: 409, error: "No puedes revocar tu propio acceso." },
  no_revocable: { status: 409, error: "Esa cuenta no es un administrador con acceso que se pueda revocar." },
  usar_cancelar: {
    status: 409,
    error: "Esa persona todavía no activa su cuenta: cancela su invitación en lugar de revocar.",
  },
};

function rechazo(error: PostgrestError, accion: string): { ok: false; status: number; error: string } {
  const conocido = error.hint ? RECHAZOS[error.hint] : undefined;
  if (conocido) return { ok: false, ...conocido };
  console.error(`Gestión de administradores: ${accion} falló`, error.code, error.message);
  return { ok: false, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
}

// ---------------------------------------------------------------------------
// Listado (GET /api/admin/administradores y /admin/administradores)
// ---------------------------------------------------------------------------

export async function listarAdministradores(): Promise<ListadoAdministradores> {
  // Perfiles e invitaciones se leen con la sesión del Propietario: la RLS es
  // otra barrera. Los correos viven en Auth y solo los lee service_role.
  const supabase = await crearClienteServidor();
  const servicio = crearClienteServicio();

  const [{ data: perfiles, error: ePerfiles }, { data: invitaciones, error: eInv }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, nombre, es_propietario, mfa_habilitado, creado_at, admin_revocado_at, admin_revocado_por")
      .eq("rol", "administrador")
      .order("creado_at", { ascending: true }),
    supabase
      .from("invitaciones_admin")
      .select("id, correo, nombre, estado, invitado_por, usuario_id, creada_at, expira_at, resuelta_at")
      .order("creada_at", { ascending: false })
      .limit(200),
  ]);
  if (ePerfiles || eInv) {
    throw new Error(`No se pudo leer la gestión de administradores: ${ePerfiles?.message ?? eInv?.message}`);
  }

  // Nombres de quien invitó o revocó: siempre administradores.
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.nombre as string | null]));
  const invitacionPorCuenta = new Map(
    (invitaciones ?? []).filter((i) => i.usuario_id).map((i) => [i.usuario_id as string, i])
  );

  // Una cuenta con la invitación sin aceptar aparece como invitación, no como administrador.
  const activos = (perfiles ?? []).filter((p) => {
    const inv = invitacionPorCuenta.get(p.id);
    return !inv || inv.estado === "aceptada";
  });

  const correos = await Promise.all(
    activos.map(async (p) => {
      const { data } = await servicio.auth.admin.getUserById(p.id);
      return data.user?.email ?? "";
    })
  );

  const ahora = Date.now();
  const administradores: AdministradorListado[] = activos.map((p, i) => ({
    id: p.id,
    nombre: p.nombre,
    correo: correos[i],
    esPropietario: p.es_propietario,
    mfaHabilitado: p.mfa_habilitado,
    creadoAt: p.creado_at,
    invitadoPorNombre: nombres.get(invitacionPorCuenta.get(p.id)?.invitado_por ?? "") ?? null,
    revocadoAt: p.admin_revocado_at,
    revocadoPorNombre: p.admin_revocado_por ? nombres.get(p.admin_revocado_por) ?? null : null,
  }));

  return {
    administradores,
    invitaciones: (invitaciones ?? []).map(
      (i): InvitacionAdminListado => ({
        id: i.id,
        correo: i.correo,
        nombre: i.nombre,
        estado:
          i.estado === "pendiente" && new Date(i.expira_at).getTime() <= ahora
            ? "vencida"
            : (i.estado as EstadoInvitacionAdmin),
        invitadoPorNombre: nombres.get(i.invitado_por) ?? null,
        creadaAt: i.creada_at,
        expiraAt: i.expira_at,
        resueltaAt: i.resuelta_at,
        tieneCuenta: i.usuario_id !== null,
      })
    ),
  };
}

// ---------------------------------------------------------------------------
// Invitar (POST /api/admin/administradores/invitar) — §9.12 pasos 1 y 2
// ---------------------------------------------------------------------------

export async function invitarAdministrador(
  ctx: Contexto,
  entrada: { correo: string; nombre: string }
): Promise<Resultado<{ id: string }>> {
  const correo = entrada.correo.trim().toLowerCase();
  const nombre = entrada.nombre.trim();
  if (!nombre) return { ok: false, status: 400, error: "Escribe el nombre de la persona." };
  if (!correo) return { ok: false, status: 400, error: "Escribe un correo válido." };

  const servicio = crearClienteServicio();

  // Una invitación pendiente ya vencida se resuelve antes de invitar de nuevo:
  // su cuenta, que nunca se activó, ocupa el correo (§9.12, "Cancelar").
  const { data: previa } = await servicio
    .from("invitaciones_admin")
    .select("id, expira_at")
    .eq("correo", correo)
    .eq("estado", "pendiente")
    .maybeSingle();
  if (previa && new Date(previa.expira_at).getTime() <= Date.now()) {
    const resuelta = await cancelarInvitacion(ctx, previa.id);
    if (!resuelta.ok) return resuelta;
  }

  const { data: id, error: eCrear } = await servicio.rpc("crear_invitacion_admin", {
    p_propietario: ctx.propietarioId,
    p_correo: correo,
    p_nombre: nombre,
  });
  if (eCrear) return rechazo(eCrear, "crear la invitación");
  const invitacionId = id as string;

  const { data: invitado, error: eInvitar } = await servicio.auth.admin.inviteUserByEmail(correo, {
    redirectTo: `${ctx.origen}/auth/definir-contrasena`,
  });
  if (eInvitar || !invitado.user) {
    // Nada salió: la invitación no queda registrada.
    await servicio.from("invitaciones_admin").delete().eq("id", invitacionId);
    const { data: quedoCuenta } = await servicio.rpc("correo_tiene_cuenta", { p_correo: correo });
    console.error("inviteUserByEmail falló", eInvitar?.code, eInvitar?.message, quedoCuenta ? "· quedó una cuenta con ese correo" : "");
    if (eInvitar?.code === "over_email_send_rate_limit") {
      return { ok: false, status: 429, error: "Se alcanzó el límite de correos por hora. Intenta de nuevo más tarde." };
    }
    return { ok: false, status: 502, error: "No pudimos enviar la invitación. Intenta de nuevo." };
  }

  const { error: eAceptar } = await servicio.rpc("aceptar_invitacion_admin", {
    p_invitacion: invitacionId,
    p_usuario: invitado.user.id,
  });
  if (eAceptar) {
    // Sin conversión no queda una empresa huérfana ni una invitación sin cuenta (§9.12).
    const { error: eBorrar } = await servicio.auth.admin.deleteUser(invitado.user.id);
    await servicio.from("invitaciones_admin").delete().eq("id", invitacionId);
    console.error("aceptar_invitacion_admin falló", eAceptar.code, eAceptar.message, eBorrar ? `· no se borró la cuenta: ${eBorrar.message}` : "");
    return { ok: false, status: 500, error: "No pudimos crear la cuenta invitada. Intenta de nuevo." };
  }

  await registrarEventoSeguridad("admin_invitado", {
    usuarioId: ctx.propietarioId,
    ruta: ctx.ruta,
    ip: ctx.ip,
    detalle: `Invitó como administrador a ${correo}.`,
  });
  return { ok: true, datos: { id: invitacionId } };
}

// ---------------------------------------------------------------------------
// Reenviar (POST /api/admin/invitaciones/[id]/reenviar)
// ---------------------------------------------------------------------------

export async function reenviarInvitacion(ctx: Contexto, invitacionId: string): Promise<Resultado> {
  const servicio = crearClienteServicio();
  const { data: inv } = await servicio
    .from("invitaciones_admin")
    .select("correo, estado, expira_at, usuario_id")
    .eq("id", invitacionId)
    .maybeSingle();
  if (!inv) return { ok: false, status: 404, error: "La invitación no existe." };
  if (inv.estado !== "pendiente" || new Date(inv.expira_at).getTime() <= Date.now() || !inv.usuario_id) {
    return { ok: false, status: 409, error: "Solo se reenvía una invitación pendiente y vigente." };
  }

  const redirectTo = `${ctx.origen}/auth/definir-contrasena`;
  const { error: eInvitar } = await servicio.auth.admin.inviteUserByEmail(inv.correo, { redirectTo });
  if (!eInvitar) return { ok: true };

  // La persona ya confirmó su correo (definió la contraseña, falta el MFA):
  // Auth no reinvita, y la recuperación lleva a la misma pantalla (§9.12).
  if (eInvitar.code === "email_exists") {
    const { error: eRecuperar } = await servicio.auth.resetPasswordForEmail(inv.correo, { redirectTo });
    if (!eRecuperar) return { ok: true, aviso: "La persona ya había definido su contraseña: le enviamos un enlace para definirla de nuevo." };
    console.error("resetPasswordForEmail falló", eRecuperar.code, eRecuperar.message);
    if (eRecuperar.code === "over_email_send_rate_limit") {
      return { ok: false, status: 429, error: "Se alcanzó el límite de correos por hora. Intenta de nuevo más tarde." };
    }
    return { ok: false, status: 502, error: "No pudimos reenviar la invitación. Intenta de nuevo." };
  }

  console.error("inviteUserByEmail (reenvío) falló", eInvitar.code, eInvitar.message);
  if (eInvitar.code === "over_email_send_rate_limit") {
    return { ok: false, status: 429, error: "Se alcanzó el límite de correos por hora. Intenta de nuevo más tarde." };
  }
  return { ok: false, status: 502, error: "No pudimos reenviar la invitación. Intenta de nuevo." };
}

// ---------------------------------------------------------------------------
// Cancelar (POST /api/admin/invitaciones/[id]/cancelar)
// ---------------------------------------------------------------------------

export async function cancelarInvitacion(ctx: Contexto, invitacionId: string): Promise<Resultado> {
  const servicio = crearClienteServicio();
  const { data, error } = await servicio.rpc("cancelar_invitacion_admin", {
    p_propietario: ctx.propietarioId,
    p_invitacion: invitacionId,
  });
  if (error) return rechazo(error, "cancelar la invitación");
  const fila = (data as { usuario_id: string | null; correo: string; estado: string; ya_resuelta: boolean }[])[0];

  if (!fila.ya_resuelta) {
    await registrarEventoSeguridad("invitacion_cancelada", {
      usuarioId: ctx.propietarioId,
      ruta: ctx.ruta,
      ip: ctx.ip,
      detalle:
        fila.estado === "vencida"
          ? `Resolvió la invitación vencida de ${fila.correo}.`
          : `Canceló la invitación de ${fila.correo}.`,
    });
  }

  // La cuenta ya no tiene privilegios (admin_vigente); se borra porque nunca se activó.
  if (fila.usuario_id) {
    const { error: eBorrar } = await servicio.auth.admin.deleteUser(fila.usuario_id);
    if (eBorrar) {
      console.error("No se pudo borrar la cuenta de la invitación cancelada", eBorrar.code, eBorrar.message);
      return {
        ok: false,
        status: 502,
        error: "La invitación quedó cancelada y la cuenta sin acceso, pero no pudimos borrarla. Usa «Reintentar borrado».",
      };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Revocar (POST /api/admin/administradores/[id]/revocar) — RF-87
// ---------------------------------------------------------------------------

// Auth no tiene bloqueo indefinido: cien años.
const BLOQUEO_INDEFINIDO = "876000h";

export async function revocarAdministrador(ctx: Contexto, adminId: string): Promise<Resultado> {
  const servicio = crearClienteServicio();
  // Marca la revocación y borra sus sesiones: desde aquí ya no tiene acceso.
  const { error } = await servicio.rpc("revocar_admin", { p_propietario: ctx.propietarioId, p_admin: adminId });
  if (error) return rechazo(error, "revocar el acceso");

  const { data: cuenta } = await servicio.auth.admin.getUserById(adminId);
  await registrarEventoSeguridad("admin_revocado", {
    usuarioId: ctx.propietarioId,
    ruta: ctx.ruta,
    ip: ctx.ip,
    detalle: `Revocó el acceso de ${cuenta.user?.email ?? adminId}.`,
  });

  const { error: eBloqueo } = await servicio.auth.admin.updateUserById(adminId, { ban_duration: BLOQUEO_INDEFINIDO });
  if (eBloqueo) {
    console.error("No se pudo bloquear la cuenta revocada", eBloqueo.code, eBloqueo.message);
    return {
      ok: true,
      aviso: "El acceso quedó revocado y sus sesiones cerradas, pero no pudimos bloquear la cuenta en Auth. Avisa al equipo técnico.",
    };
  }
  return { ok: true };
}
