"use client";

import { create } from "zustand";
import {
  calificaciones as calificacionesIniciales,
  categorias as categoriasIniciales,
  consultores as consultoresIniciales,
  convocatorias as convocatoriasIniciales,
  documentos as documentosIniciales,
  empresas as empresasIniciales,
  encargos as encargosIniciales,
  estadisticasIA as estadisticasIAIniciales,
  eventosSeguridad as eventosSeguridadIniciales,
  fuentes as fuentesIniciales,
  pagos as pagosIniciales,
  planes as planesIniciales,
  postulaciones as postulacionesIniciales,
  promptVersiones as promptVersionesIniciales,
  proyectos as proyectosIniciales,
  suscripciones as suscripcionesIniciales,
} from "./mock-data";
import { componerDocumento, aplicarAjusteTexto } from "./documentos";
import type {
  Calificacion,
  Categoria,
  Convocatoria,
  DocumentoGenerado,
  Empresa,
  Encargo,
  EstadisticasIA,
  EventoSeguridad,
  Fuente,
  DatosSesion,
  Pago,
  PerfilConsultor,
  Plan,
  Postulacion,
  PromptVersion,
  Proyecto,
  SeccionDocumento,
  Suscripcion,
  TipoAyudaEncargo,
} from "./types";
import { TARIFAS_POR_DEFECTO, type TarifasIA } from "./types";

let contador = 1000;
function nuevoId(prefijo: string): string {
  contador += 1;
  return `${prefijo}-${contador}`;
}

/**
 * Propietario de la sesión (RN-30): el auth.uid() real de Supabase Auth. Las
 * comprobaciones que lo usan aquí pasan a la API route y a la política RLS
 * cuando cada entidad se conecte a la base.
 */
function usuarioSesion(sesion: DatosSesion["sesion"] | null): string {
  return sesion?.usuarioId ?? "";
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface SolicitudConsultor {
  proyectoId: string;
  tituloTarea: string;
  descripcionTarea: string;
  // Elegido en el paso 1 del flujo (CU-19, RF-28 mod. v5).
  tipoAyuda: TipoAyudaEncargo;
  convocatoriaId: string | null; // solo si tipoAyuda = convocatoria_especifica
}

interface AppState {
  categorias: Categoria[];
  convocatorias: Convocatoria[];
  proyectos: Proyecto[];
  postulaciones: Postulacion[];
  fuentes: Fuente[];
  empresas: Empresa[];
  consultores: PerfilConsultor[];
  encargos: Encargo[];
  calificaciones: Calificacion[];
  planes: Plan[];
  suscripciones: Suscripcion[];
  pagos: Pago[];
  documentos: DocumentoGenerado[];
  promptVersiones: PromptVersion[];
  estadisticasIA: EstadisticasIA;
  eventosSeguridad: EventoSeguridad[];

  // Sesión real de Supabase Auth, entregada por el layout del servidor
  sesion: DatosSesion["sesion"] | null;
  hidratarSesion: (datos: DatosSesion) => void;
  /** Sprint 2 paso 4: el catálogo real, ya autorizado en el servidor (RN-33). */
  hidratarCatalogo: (convocatorias: Convocatoria[], categorias: Categoria[]) => void;

  // Seguridad y auditoría (CU-38..40, RNF-25..28, nuevo v5)
  liberarBloqueoSeguridad: (eventoId: string) => void;

  // Modal de suscripción
  modalSuscripcionAbierto: boolean;
  motivoModalSuscripcion: string;
  abrirModalSuscripcion: (motivo?: string) => void;
  cerrarModalSuscripcion: () => void;

  // Modal de créditos IA
  modalCreditosAbierto: boolean;
  motivoModalCreditos: string;
  abrirModalCreditos: (motivo?: string) => void;
  cerrarModalCreditos: () => void;
  consumirCredito: (usuarioId: string) => void;

  // Generación de documentos con IA
  proyectoParaGenerar: string | null;
  setProyectoParaGenerar: (proyectoId: string) => void;
  limpiarProyectoParaGenerar: () => void;
  crearDocumento: (proyectoId: string, convocatoriaId: string) => DocumentoGenerado;
  actualizarSeccionDocumento: (
    documentoId: string,
    seccionId: string,
    contenido: string,
    autor?: "empresa" | "consultor"
  ) => void;
  marcarDocumentoExportado: (documentoId: string) => void;
  regenerarDocumento: (documentoId: string) => DocumentoGenerado | null;
  aplicarAjusteIA: (documentoId: string, instruccion: string, autor?: "empresa" | "consultor") => void;
  registrarGeneracionFallida: () => void;

  // Compartir documento con el consultor (RN-22, RN-27, RF-71/72, nuevo v5)
  compartirDocumento: (documentoId: string, consultorId: string) => void;
  revocarCompartirDocumento: (documentoId: string) => void;

  // Proyectos
  /** Sprint 3 paso 1: los proyectos reales de la empresa, leídos en el servidor (RN-30). */
  hidratarProyectos: (proyectos: Proyecto[]) => void;

  // Postulaciones
  hidratarPostulaciones: (postulaciones: Postulacion[]) => void;
  /** Sprint 4 paso 3: los encargos reales de la empresa, para la ficha del proyecto y documentos. */
  hidratarEncargos: (encargos: Encargo[]) => void;
  /** Sprint 5: los documentos reales de la empresa (docs/05 §9.26), para la ficha de la postulación y la lista. */
  hidratarDocumentos: (documentos: DocumentoGenerado[]) => void;

  // Fuentes
  agregarFuente: (f: Omit<Fuente, "id">) => void;
  actualizarFuente: (id: string, f: Omit<Fuente, "id">) => void;
  eliminarFuente: (id: string) => void;

  // Convocatorias (admin)
  agregarConvocatoria: (c: Omit<Convocatoria, "id">) => Convocatoria;
  actualizarConvocatoria: (id: string, cambios: Partial<Convocatoria>) => void;
  eliminarConvocatoria: (id: string) => void;

  // Categorías
  agregarCategoria: (c: Omit<Categoria, "id">) => void;
  eliminarCategoria: (id: string) => void;

  // Flujo de solicitud de consultor
  solicitudConsultorEnCurso: SolicitudConsultor | null;
  iniciarSolicitudConsultor: (s: SolicitudConsultor) => void;
  cancelarSolicitudConsultor: () => void;
  // Encargos: crear, responder, avances, completar, calificar, retirar y
  // atender viven en el servidor desde la sesión 023 (docs/05 §9.23).

  // Planes: los reales del rol, leídos en el servidor (RF-82, docs/05 §9.28).
  // Crear, editar, activar suscripciones y otorgar paquetes van por /api/admin.
  hidratarPlanes: (planes: Plan[]) => void;

  // RN-17, RF-100: cuántos créditos cuesta cada uso de la IA (leídas en el servidor).
  tarifas: TarifasIA;
  hidratarTarifas: (tarifas: TarifasIA) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  categorias: categoriasIniciales,
  convocatorias: convocatoriasIniciales,
  proyectos: proyectosIniciales,
  postulaciones: postulacionesIniciales,
  fuentes: fuentesIniciales,
  empresas: empresasIniciales,
  consultores: consultoresIniciales,
  encargos: encargosIniciales,
  calificaciones: calificacionesIniciales,
  planes: planesIniciales,
  tarifas: TARIFAS_POR_DEFECTO,
  hidratarTarifas: (tarifas) => set({ tarifas }),
  suscripciones: suscripcionesIniciales,
  pagos: pagosIniciales,
  documentos: documentosIniciales,
  promptVersiones: promptVersionesIniciales,
  estadisticasIA: estadisticasIAIniciales,
  eventosSeguridad: eventosSeguridadIniciales,

  sesion: null,
  // Mientras las demás entidades sigan en datos de ejemplo, la suscripción, el
  // plan y el perfil de consultor reales se integran a esas listas para que el
  // resto de la interfaz los encuentre por el id de la sesión.
  // Las convocatorias y categorías de ejemplo se sustituyen por las reales: el
  // resto del portal (postular, generar, sugerencias) las busca aquí mientras
  // sus propios endpoints no existan (Sprints 3 y 4).
  hidratarCatalogo: (convocatorias, categorias) => set({ convocatorias, categorias }),

  hidratarSesion: (datos) => {
    set((s) => {
      let planes = s.planes;
      if (datos.plan) {
        const real = datos.plan;
        planes = [...planes.filter((p) => p.id !== real.id), real];
      }
      const suscripciones = datos.suscripcion
        ? [...s.suscripciones.filter((x) => x.id !== datos.suscripcion!.id), datos.suscripcion]
        : s.suscripciones;
      // El perfil de consultor real reemplaza al local: desde el Sprint 4 se
      // edita por la API (docs/05 §9.20) y el servidor es la fuente de verdad.
      const consultores = datos.consultor
        ? [...s.consultores.filter((c) => c.id !== datos.consultor!.id), datos.consultor]
        : s.consultores;
      return { sesion: datos.sesion, planes, suscripciones, consultores };
    });
  },

  // -------------------------------------------------------------------------
  // Seguridad y auditoría (CU-38..40, RNF-25..28)
  // -------------------------------------------------------------------------

  liberarBloqueoSeguridad: (eventoId) => {
    set((s) => ({
      eventosSeguridad: s.eventosSeguridad.map((e) =>
        e.id === eventoId ? { ...e, bloqueadoHasta: new Date(0).toISOString() } : e
      ),
    }));
  },

  modalSuscripcionAbierto: false,
  motivoModalSuscripcion: "",
  abrirModalSuscripcion: (motivo) =>
    set({ modalSuscripcionAbierto: true, motivoModalSuscripcion: motivo ?? "continuar" }),
  cerrarModalSuscripcion: () => set({ modalSuscripcionAbierto: false }),

  // Crear, editar y eliminar proyectos pasa por /api/proyectos (docs/05 §9.17):
  // aquí solo se reciben los reales para las pantallas que aún leen del store
  // (sugerencias, generar, postular, encargos).
  hidratarProyectos: (proyectos) => set({ proyectos }),

  // Iniciar, marcar el checklist, cambiar el estado y vincular el proyecto
  // pasan por /api/postulaciones y /api/checklist (docs/05 §9.19): aquí solo
  // se reciben las reales para las pantallas que aún leen del store (generar,
  // documentos, encargos).
  hidratarPostulaciones: (postulaciones) => set({ postulaciones }),
  hidratarEncargos: (encargos) => set({ encargos }),
  hidratarDocumentos: (documentos) => set({ documentos }),

  agregarFuente: (f) => {
    set((s) => ({ fuentes: [...s.fuentes, { ...f, id: nuevoId("fuente") }] }));
  },
  actualizarFuente: (id, f) => {
    set((s) => ({ fuentes: s.fuentes.map((fu) => (fu.id === id ? { ...fu, ...f } : fu)) }));
  },
  eliminarFuente: (id) => {
    set((s) => ({ fuentes: s.fuentes.filter((f) => f.id !== id) }));
  },

  agregarConvocatoria: (c) => {
    const nueva: Convocatoria = { ...c, id: nuevoId("conv") };
    set((s) => ({ convocatorias: [...s.convocatorias, nueva] }));
    return nueva;
  },
  actualizarConvocatoria: (id, cambios) => {
    set((s) => ({
      convocatorias: s.convocatorias.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
    }));
  },
  eliminarConvocatoria: (id) => {
    set((s) => ({ convocatorias: s.convocatorias.filter((c) => c.id !== id) }));
  },

  agregarCategoria: (c) => {
    set((s) => ({ categorias: [...s.categorias, { ...c, id: nuevoId("cat") }] }));
  },
  eliminarCategoria: (id) => {
    set((s) => ({ categorias: s.categorias.filter((c) => c.id !== id) }));
  },

  // -------------------------------------------------------------------------
  // Flujo de solicitud de consultor
  // -------------------------------------------------------------------------

  solicitudConsultorEnCurso: null,
  iniciarSolicitudConsultor: (solicitud) => set({ solicitudConsultorEnCurso: solicitud }),
  cancelarSolicitudConsultor: () => set({ solicitudConsultorEnCurso: null }),

  // -------------------------------------------------------------------------
  // Encargos: en el servidor desde la sesión 023 (lib/encargos-servidor.ts).
  // -------------------------------------------------------------------------

  // Perfiles de consultor: revisar, suspender y reactivar viven en el
  // servidor desde la sesión 022 (docs/05 §9.21, /api/admin/consultores).

  // El plan actual de la sesión se conserva aunque esté inactivo: la vista del
  // suscriptor lo sigue mostrando (RF-41).
  hidratarPlanes: (planes) => {
    set((s) => {
      const actual = s.suscripciones.find((x) => x.usuarioId === s.sesion?.usuarioId)?.planId;
      const conservar = s.planes.filter((p) => p.id === actual && !planes.some((n) => n.id === p.id));
      return { planes: [...planes, ...conservar] };
    });
  },

  // -------------------------------------------------------------------------
  // Créditos de IA
  // -------------------------------------------------------------------------

  modalCreditosAbierto: false,
  motivoModalCreditos: "",
  abrirModalCreditos: (motivo) => set({ modalCreditosAbierto: true, motivoModalCreditos: motivo ?? "generar el documento" }),
  cerrarModalCreditos: () => set({ modalCreditosAbierto: false }),

  consumirCredito: (usuarioId) => {
    set((s) => ({
      suscripciones: s.suscripciones.map((sub) =>
        sub.usuarioId === usuarioId ? { ...sub, creditosUsadosPeriodo: sub.creditosUsadosPeriodo + 1 } : sub
      ),
    }));
  },

  // -------------------------------------------------------------------------
  // Generación de documentos con IA
  // -------------------------------------------------------------------------

  proyectoParaGenerar: null,
  setProyectoParaGenerar: (proyectoId) => set({ proyectoParaGenerar: proyectoId }),
  limpiarProyectoParaGenerar: () => set({ proyectoParaGenerar: null }),

  crearDocumento: (proyectoId, convocatoriaId) => {
    const proyecto = get().proyectos.find((p) => p.id === proyectoId);
    const convocatoria = get().convocatorias.find((c) => c.id === convocatoriaId);
    const promptActiva = get().promptVersiones.find((p) => p.activa) ?? get().promptVersiones[get().promptVersiones.length - 1];
    const hoy = hoyIso();

    let secciones: SeccionDocumento[] = [];
    let titulo = "Documento sin título";
    if (proyecto && convocatoria) {
      const resultado = componerDocumento(proyecto, convocatoria);
      secciones = resultado.secciones;
      titulo = resultado.secciones.find((s) => s.id === "titulo")?.contenido ?? `${proyecto.nombre} — ${convocatoria.nombre}`;
    }

    const nuevo: DocumentoGenerado = {
      id: nuevoId("doc"),
      // RN-30/RN-28: el dueño es la empresa del proyecto, no quien dispara la acción.
      usuarioId: proyecto?.usuarioId ?? usuarioSesion(get().sesion),
      proyectoId,
      convocatoriaId,
      titulo,
      version: 1,
      estado: "generado",
      promptVersionId: promptActiva?.id ?? "",
      secciones,
      ajustesGratisUsados: 0,
      fechaCreacion: hoy,
      fechaActualizacion: hoy,
      compartidoConConsultorId: null,
      ultimaEdicionPor: null,
    };

    set((s) => ({
      documentos: [...s.documentos, nuevo],
      estadisticasIA: { ...s.estadisticasIA, generaciones: s.estadisticasIA.generaciones + 1 },
    }));
    return nuevo;
  },

  actualizarSeccionDocumento: (documentoId, seccionId, contenido, autor = "empresa") => {
    set((s) => ({
      documentos: s.documentos.map((d) =>
        d.id === documentoId
          ? {
              ...d,
              estado: "editado",
              fechaActualizacion: hoyIso(),
              ultimaEdicionPor: autor,
              secciones: d.secciones.map((sec) => (sec.id === seccionId ? { ...sec, contenido } : sec)),
            }
          : d
      ),
    }));
  },

  marcarDocumentoExportado: (documentoId) => {
    set((s) => ({
      documentos: s.documentos.map((d) => (d.id === documentoId ? { ...d, estado: "exportado" } : d)),
    }));
  },

  regenerarDocumento: (documentoId) => {
    const doc = get().documentos.find((d) => d.id === documentoId);
    if (!doc) return null;
    const proyecto = get().proyectos.find((p) => p.id === doc.proyectoId);
    const convocatoria = get().convocatorias.find((c) => c.id === doc.convocatoriaId);
    if (!proyecto || !convocatoria) return null;
    const promptActiva = get().promptVersiones.find((p) => p.activa) ?? get().promptVersiones[get().promptVersiones.length - 1];
    const resultado = componerDocumento(proyecto, convocatoria);
    const hoy = hoyIso();

    let actualizado: DocumentoGenerado | null = null;
    set((s) => ({
      documentos: s.documentos.map((d) => {
        if (d.id !== documentoId) return d;
        actualizado = {
          ...d,
          version: d.version + 1,
          estado: "generado",
          promptVersionId: promptActiva?.id ?? d.promptVersionId,
          secciones: resultado.secciones,
          ajustesGratisUsados: 0,
          fechaActualizacion: hoy,
        };
        return actualizado;
      }),
      estadisticasIA: { ...s.estadisticasIA, generaciones: s.estadisticasIA.generaciones + 1 },
    }));
    return actualizado;
  },

  aplicarAjusteIA: (documentoId, instruccion, autor = "empresa") => {
    set((s) => ({
      documentos: s.documentos.map((d) =>
        d.id === documentoId
          ? {
              ...d,
              secciones: aplicarAjusteTexto(d.secciones, instruccion),
              ajustesGratisUsados: d.ajustesGratisUsados + 1,
              estado: "editado",
              fechaActualizacion: hoyIso(),
              ultimaEdicionPor: autor,
            }
          : d
      ),
      estadisticasIA: { ...s.estadisticasIA, ajustes: s.estadisticasIA.ajustes + 1 },
    }));
  },

  registrarGeneracionFallida: () => {
    set((s) => ({ estadisticasIA: { ...s.estadisticasIA, fallidas: s.estadisticasIA.fallidas + 1 } }));
  },

  // -------------------------------------------------------------------------
  // Compartir documento con el consultor (RN-22, RN-27, RF-71/72)
  // -------------------------------------------------------------------------

  compartirDocumento: (documentoId, consultorId) => {
    set((s) => ({
      documentos: s.documentos.map((d) =>
        d.id === documentoId ? { ...d, compartidoConConsultorId: consultorId } : d
      ),
    }));
  },
  revocarCompartirDocumento: (documentoId) => {
    set((s) => ({
      documentos: s.documentos.map((d) =>
        d.id === documentoId ? { ...d, compartidoConConsultorId: null } : d
      ),
    }));
  },
}));
