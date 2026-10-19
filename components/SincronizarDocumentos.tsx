"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { DocumentoGenerado } from "@/lib/types";

/**
 * Entrega al store los documentos que el layout leyó en el servidor con la
 * sesión de la empresa (RN-30, Sprint 5), para las pantallas que aún leen del
 * store (lista de documentos, detalle de la postulación). Como
 * SincronizarPostulaciones. No autoriza nada.
 */
export function SincronizarDocumentos({ documentos }: { documentos: DocumentoGenerado[] }) {
  useState(() => {
    useAppStore.getState().hidratarDocumentos(documentos);
    return true;
  });

  const clave = JSON.stringify(documentos);
  useEffect(() => {
    useAppStore.getState().hidratarDocumentos(JSON.parse(clave) as DocumentoGenerado[]);
  }, [clave]);

  return null;
}
