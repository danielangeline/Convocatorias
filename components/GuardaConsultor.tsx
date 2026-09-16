"use client";

import { Lock, AlertCircle, Clock } from "lucide-react";
import { useConsultorActual } from "@/lib/hooks";
import { EmptyState } from "./ui/EmptyState";
import { LinkButton } from "./ui/Button";

/**
 * Envuelve las secciones del portal de consultor que requieren un perfil
 * aprobado (Mis encargos, Mi suscripción). "Mi perfil" nunca usa esta guarda,
 * ya que siempre debe estar disponible para completar o corregir el perfil.
 */
export function GuardaConsultor({ children }: { children: React.ReactNode }) {
  const { consultorId, consultor } = useConsultorActual();

  if (!consultorId || !consultor) {
    return (
      <EmptyState
        icon={Lock}
        titulo="Esta sección es para consultores"
        descripcion="Esta sección pertenece al portal de consultores y tu cuenta no tiene un perfil de consultor."
      />
    );
  }

  if (consultor.estadoPerfil === "aprobado") {
    return <>{children}</>;
  }

  if (consultor.estadoPerfil === "en_revision") {
    return (
      <EmptyState
        icon={Clock}
        titulo="Tu perfil está siendo revisado"
        descripcion="Nuestro equipo está validando tu información. Cuando tu perfil sea aprobado podrás ver esta sección."
        accion={
          <LinkButton href="/consultor/perfil" variant="secondary">
            Ver mi perfil
          </LinkButton>
        }
      />
    );
  }

  if (consultor.estadoPerfil === "rechazado") {
    return (
      <EmptyState
        icon={AlertCircle}
        titulo="Tu perfil fue rechazado"
        descripcion={
          consultor.motivoRechazo
            ? `Motivo: ${consultor.motivoRechazo}`
            : "Corrige tu perfil y vuelve a enviarlo a revisión para acceder a esta sección."
        }
        accion={
          <LinkButton href="/consultor/perfil" variant="primary">
            Corregir y reenviar
          </LinkButton>
        }
      />
    );
  }

  if (consultor.estadoPerfil === "suspendido") {
    return (
      <EmptyState
        icon={Lock}
        titulo="Tu perfil está suspendido"
        descripcion="Un administrador suspendió temporalmente tu cuenta de consultor. Contacta al equipo de la plataforma para más información."
      />
    );
  }

  return (
    <EmptyState
      icon={AlertCircle}
      titulo="Completa tu perfil"
      descripcion="Debes completar y enviar tu perfil a revisión antes de acceder a esta sección."
      accion={
        <LinkButton href="/consultor/perfil" variant="primary">
          Completar mi perfil
        </LinkButton>
      }
    />
  );
}
