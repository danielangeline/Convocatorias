"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { DatosSesion } from "@/lib/types";

/**
 * Entrega al store del cliente la sesión que el layout leyó en el servidor.
 * La primera vez se hidrata durante el render —antes que la barra y las
 * páginas— para que ninguna pantalla se pinte con la sesión vacía; los cambios
 * posteriores (p. ej. tras router.refresh) llegan por el efecto. No autoriza
 * nada: la sesión y el rol ya se comprobaron en el servidor.
 */
export function SincronizarSesion({ datos }: { datos: DatosSesion }) {
  // Solo si el store aún no tiene sesión: si ya había una (p. ej. al pasar del
  // MFA al panel), cambiarla durante el render actualizaría la barra mientras
  // se pinta y React lo advierte; ese caso lo cubre el efecto.
  useState(() => {
    if (!useAppStore.getState().sesion) useAppStore.getState().hidratarSesion(datos);
    return true;
  });

  // Cada render del servidor trae un objeto nuevo: se compara por contenido.
  const clave = JSON.stringify(datos);
  useEffect(() => {
    useAppStore.getState().hidratarSesion(JSON.parse(clave) as DatosSesion);
  }, [clave]);

  return null;
}
