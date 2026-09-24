"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Postulacion } from "@/lib/types";

/**
 * Entrega al store las postulaciones que el layout leyó en el servidor con la
 * sesión de la empresa (RN-30, Sprint 3 paso 3), para las pantallas que aún
 * leen del store (generar, documentos, encargos). Como SincronizarProyectos:
 * la primera vez durante el render, después por el efecto (tras router.refresh).
 * No autoriza nada.
 */
export function SincronizarPostulaciones({ postulaciones }: { postulaciones: Postulacion[] }) {
  useState(() => {
    useAppStore.getState().hidratarPostulaciones(postulaciones);
    return true;
  });

  const clave = JSON.stringify(postulaciones);
  useEffect(() => {
    useAppStore.getState().hidratarPostulaciones(JSON.parse(clave) as Postulacion[]);
  }, [clave]);

  return null;
}
