"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { crearClienteServidor, crearClienteServicio } from "@/lib/supabase/servidor";
import { obtenerSesion } from "@/lib/auth";
import { rutaInicioDeRol } from "@/lib/rutas";
import type { RolUsuario } from "@/lib/types";

export interface ResultadoFormulario {
  error?: string;
  mensaje?: string;
}

async function ipDeLaPeticion(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  return ip || null;
}

async function origenDeLaPeticion(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocolo = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

/** Escribe un evento de seguridad con service_role: el cliente no puede (RF-65, docs/05 §9.9). */
async function registrarEvento(
  tipo: "login_fallido" | "mfa_activado" | "mfa_fallido",
  datos: { usuarioId?: string | null; ruta: string; detalle: string }
) {
  const servicio = crearClienteServicio();
  const { error } = await servicio.from("eventos_seguridad").insert({
    tipo,
    usuario_id: datos.usuarioId ?? null,
    ip: await ipDeLaPeticion(),
    ruta: datos.ruta,
    detalle: datos.detalle,
  });
  if (error) console.error("No se pudo registrar el evento de seguridad", tipo, error.message);
}

// ---------------------------------------------------------------------------
// Registro (CU-14, RF-01): el rol viaja en los metadatos y el trigger de la
// base crea perfil, trial o perfil de consultor. Pedir "administrador" no sirve
// de nada: la base lo convierte en empresa (RN-06).
// ---------------------------------------------------------------------------

export async function registrarse(_previo: ResultadoFormulario, formulario: FormData): Promise<ResultadoFormulario> {
  const rol = formulario.get("rol") === "consultor" ? "consultor" : "empresa";
  const nombre = String(formulario.get("nombre") ?? "").trim();
  const nombreEmpresa = String(formulario.get("nombre_empresa") ?? "").trim();
  const correo = String(formulario.get("correo") ?? "").trim().toLowerCase();
  const contrasena = String(formulario.get("contrasena") ?? "");

  if (!nombre || !correo) return { error: "Escribe tu nombre y tu correo." };
  if (rol === "empresa" && !nombreEmpresa) return { error: "Escribe el nombre de la empresa." };
  if (contrasena.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    options: {
      emailRedirectTo: `${await origenDeLaPeticion()}/auth/confirmar`,
      data: { rol, nombre, nombre_empresa: rol === "empresa" ? nombreEmpresa : null },
    },
  });

  if (error) {
    if (error.code === "weak_password") return { error: "La contraseña es demasiado débil. Usa una más larga o combinada." };
    if (error.code === "over_email_send_rate_limit") {
      return { error: "Se alcanzó el límite de correos de confirmación. Intenta de nuevo en unos minutos." };
    }
    console.error("Registro fallido", error.code, error.message);
    return { error: "No pudimos crear la cuenta. Intenta de nuevo." };
  }

  // Con confirmación de correo activa no hay sesión hasta confirmar. Si el
  // proyecto la tuviera desactivada, la cuenta entra directo.
  if (data.session) redirect(rutaInicioDeRol(rol));

  return {
    mensaje: `Te enviamos un enlace a ${correo}. Ábrelo para confirmar tu correo y entrar a la plataforma.`,
  };
}

// ---------------------------------------------------------------------------
// Inicio y cierre de sesión (CU-14, RF-02)
// ---------------------------------------------------------------------------

export async function iniciarSesion(_previo: ResultadoFormulario, formulario: FormData): Promise<ResultadoFormulario> {
  const correo = String(formulario.get("correo") ?? "").trim().toLowerCase();
  const contrasena = String(formulario.get("contrasena") ?? "");
  if (!correo || !contrasena) return { error: "Escribe tu correo y tu contraseña." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });

  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") {
      return { error: "Todavía no confirmas tu correo. Revisa tu bandeja de entrada." };
    }
    await registrarEvento("login_fallido", { ruta: "/login", detalle: `Inicio de sesión fallido para ${correo}` });
    // Mismo mensaje exista o no la cuenta: no se revela qué correos están registrados.
    return { error: "Correo o contraseña incorrectos." };
  }

  // El mismo cliente ya tiene la sesión en memoria.
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", data.user.id).maybeSingle();
  if (!perfil) {
    await supabase.auth.signOut();
    return { error: "Tu cuenta no tiene un perfil válido. Contacta al equipo de la plataforma." };
  }

  // El administrador no entra sin segundo factor (RNF-28): el layout de /admin
  // lo mandaría a /mfa de todas formas; se ahorra el salto.
  if (perfil.rol === "administrador") redirect("/mfa");
  redirect(rutaInicioDeRol(perfil.rol as RolUsuario));
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// MFA del administrador (CU-38, RF-64, RNF-28)
// El factor se enrola y verifica en el navegador contra Supabase Auth; aquí se
// comprueba en el servidor que la sesión ya es aal2 antes de marcar el perfil.
// ---------------------------------------------------------------------------

export async function confirmarMfa(): Promise<ResultadoFormulario> {
  const datos = await obtenerSesion();
  if (!datos || datos.sesion.rol !== "administrador") return { error: "Sesión no válida." };
  if (datos.sesion.aal !== "aal2") return { error: "El segundo factor no quedó verificado en esta sesión." };

  const servicio = crearClienteServicio();
  const { data: perfil } = await servicio
    .from("perfiles")
    .select("mfa_habilitado")
    .eq("id", datos.sesion.usuarioId)
    .single();

  if (perfil && !perfil.mfa_habilitado) {
    const { error } = await servicio.from("perfiles").update({ mfa_habilitado: true }).eq("id", datos.sesion.usuarioId);
    // No se oculta: en la sesión 007 este update fallaba en silencio (42501).
    if (error) {
      console.error("No se pudo marcar mfa_habilitado", error.code, error.message);
      return { error: "Tu segundo factor quedó activo, pero no pudimos registrarlo. Intenta de nuevo." };
    }
    await registrarEvento("mfa_activado", {
      usuarioId: datos.sesion.usuarioId,
      ruta: "/mfa",
      detalle: "Verificación en dos pasos activada.",
    });
  }

  redirect("/admin");
}

export async function registrarMfaFallido(): Promise<void> {
  const datos = await obtenerSesion();
  if (!datos) return;
  await registrarEvento("mfa_fallido", {
    usuarioId: datos.sesion.usuarioId,
    ruta: "/mfa",
    detalle: "Código de verificación en dos pasos incorrecto.",
  });
}
