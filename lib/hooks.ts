"use client";

import { useMemo } from "react";
import { useAppStore } from "./store";
import { usuarioIdDeModo, consultorIdDeModo, rolDeModo } from "./session";
import { agregarMeses, diasRestantesHasta } from "./utils";

const ESTADOS_CON_ACCESO = new Set(["trial", "activa", "en_gracia"]);

/**
 * Resuelve si el usuario simulado actual (según el modo demo) tiene una
 * suscripción vigente. Si no encuentra una suscripción para el usuario
 * (p. ej. el administrador) se asume acceso libre: la restricción solo
 * aplica quien tiene una suscripción registrada y está vencida/suspendida.
 */
export function useAccesoSuscripcion() {
  const modoDemo = useAppStore((s) => s.modoDemo);
  const suscripciones = useAppStore((s) => s.suscripciones);
  const abrirModalSuscripcion = useAppStore((s) => s.abrirModalSuscripcion);

  const usuarioId = usuarioIdDeModo(modoDemo);
  const rol = rolDeModo(modoDemo);
  const suscripcion = suscripciones.find((s) => s.usuarioId === usuarioId);
  const tieneAcceso = rol === "admin" || !suscripcion || ESTADOS_CON_ACCESO.has(suscripcion.estado);
  const diasRestantes = suscripcion ? diasRestantesHasta(suscripcion.fechaVencimiento) : null;

  function requerirAcceso(motivo?: string): boolean {
    if (tieneAcceso) return true;
    abrirModalSuscripcion(motivo);
    return false;
  }

  return { usuarioId, rol, suscripcion, tieneAcceso, diasRestantes, requerirAcceso };
}

/**
 * Créditos de IA disponibles para el usuario simulado actual, según su
 * suscripción vigente (incluidos del plan + extras comprados - usados en el
 * ciclo actual). Si no hay suscripción registrada, no hay créditos.
 */
export function useCreditos() {
  const modoDemo = useAppStore((s) => s.modoDemo);
  const suscripciones = useAppStore((s) => s.suscripciones);
  const planes = useAppStore((s) => s.planes);

  const usuarioId = usuarioIdDeModo(modoDemo);
  const suscripcion = suscripciones.find((s) => s.usuarioId === usuarioId);
  const plan = suscripcion ? planes.find((p) => p.id === suscripcion.planId) : undefined;

  const incluidos = plan?.creditosIaMensuales ?? 0;
  const usados = suscripcion?.creditosUsadosPeriodo ?? 0;
  const extra = suscripcion?.creditosExtra ?? 0;
  const disponibles = Math.max(0, incluidos + extra - usados);
  const fechaReinicio = suscripcion ? agregarMeses(suscripcion.periodoCreditosInicio, 1) : null;

  return { usuarioId, suscripcion, plan, disponibles, usados, incluidos, extra, fechaReinicio };
}

export function useConsultorActual() {
  const modoDemo = useAppStore((s) => s.modoDemo);
  const consultores = useAppStore((s) => s.consultores);
  const consultorId = consultorIdDeModo(modoDemo);
  const consultor = consultorId ? consultores.find((c) => c.id === consultorId) : undefined;
  return { consultorId, consultor };
}

/**
 * Listados del portal Empresa filtrados por el propietario de la sesión
 * (RN-30, RNF-03). Los listados y fichas del portal Empresa leen de aquí,
 * no de `s.proyectos`, `s.postulaciones`, `s.documentos` ni `s.encargos`.
 * La excepción es la ficha de documento, compartida con el consultor
 * autorizado, que aplica su propia guarda de propietario.
 * Al conectar Supabase el filtro lo aplica el endpoint y lo respalda RLS.
 */
export function usePropietarioSesion() {
  const modoDemo = useAppStore((s) => s.modoDemo);
  return usuarioIdDeModo(modoDemo);
}

export function useProyectosPropios() {
  const usuarioId = usePropietarioSesion();
  const proyectos = useAppStore((s) => s.proyectos);
  return useMemo(() => proyectos.filter((p) => p.usuarioId === usuarioId), [proyectos, usuarioId]);
}

export function usePostulacionesPropias() {
  const usuarioId = usePropietarioSesion();
  const postulaciones = useAppStore((s) => s.postulaciones);
  return useMemo(() => postulaciones.filter((p) => p.usuarioId === usuarioId), [postulaciones, usuarioId]);
}

export function useDocumentosPropios() {
  const usuarioId = usePropietarioSesion();
  const documentos = useAppStore((s) => s.documentos);
  return useMemo(() => documentos.filter((d) => d.usuarioId === usuarioId), [documentos, usuarioId]);
}

export function useEncargosPropios() {
  const usuarioId = usePropietarioSesion();
  const encargos = useAppStore((s) => s.encargos);
  return useMemo(() => encargos.filter((e) => e.empresaId === usuarioId), [encargos, usuarioId]);
}
