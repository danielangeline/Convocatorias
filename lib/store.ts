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
  PAQUETE_CREDITOS_CANTIDAD,
  PAQUETE_CREDITOS_PRECIO,
  pagos as pagosIniciales,
  planes as planesIniciales,
  postulaciones as postulacionesIniciales,
  promptVersiones as promptVersionesIniciales,
  proyectos as proyectosIniciales,
  suscripciones as suscripcionesIniciales,
} from "./mock-data";
import { componerDocumento, aplicarAjusteTexto, postulacionParaProyectoConv } from "./documentos";
import { transicionPermitida } from "./utils";
import { usuarioIdDeModo } from "./session";
import type {
  Calificacion,
  Categoria,
  ChecklistItem,
  Convocatoria,
  DocumentoGenerado,
  Empresa,
  Encargo,
  EstadisticasIA,
  EstadoEncargo,
  EstadoPostulacion,
  EventoSeguridad,
  Fuente,
  ItemPortafolio,
  ModalidadSuscripcion,
  ModoDemo,
  Pago,
  PerfilConsultor,
  Plan,
  Postulacion,
  PromptVersion,
  Proyecto,
  RedSocial,
  SeccionDocumento,
  Suscripcion,
  TipoAyudaEncargo,
} from "./types";

let contador = 1000;
function nuevoId(prefijo: string): string {
  contador += 1;
  return `${prefijo}-${contador}`;
}

/**
 * Propietario de la sesión simulada (RN-30). Al conectar Supabase lo sustituye
 * auth.uid(), y estas comprobaciones pasan a la API route y a la política RLS.
 */
function usuarioSesion(modo: ModoDemo): string {
  return usuarioIdDeModo(modo);
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function sumarPeriodo(fechaBaseIso: string, modalidad: ModalidadSuscripcion): string {
  const base = new Date(fechaBaseIso + "T00:00:00");
  if (modalidad === "anual") {
    base.setFullYear(base.getFullYear() + 1);
  } else {
    base.setMonth(base.getMonth() + 1);
  }
  return base.toISOString().slice(0, 10);
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

  // Simulador de modo demo
  modoDemo: ModoDemo;
  setModoDemo: (modo: ModoDemo) => void;

  // Seguridad y auditoría (CU-38..40, RNF-25..28, nuevo v5)
  mfaVerificado: boolean;
  verificarMFA: () => void;
  liberarBloqueoSeguridad: (eventoId: string) => void;

  // Modal de suscripción
  modalSuscripcionAbierto: boolean;
  motivoModalSuscripcion: string;
  abrirModalSuscripcion: (motivo?: string) => void;
  cerrarModalSuscripcion: () => void;
  simularPago: (usuarioId: string, planId: string, modalidad: ModalidadSuscripcion) => void;

  // Modal de créditos IA
  modalCreditosAbierto: boolean;
  motivoModalCreditos: string;
  abrirModalCreditos: (motivo?: string) => void;
  cerrarModalCreditos: () => void;
  consumirCredito: (usuarioId: string) => void;
  otorgarCreditosExtra: (suscripcionId: string, cantidad: number) => void;
  comprarPaqueteCreditos: (usuarioId: string) => void;

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

  // Plantillas de prompt (panel admin)
  agregarVersionPrompt: (contenido: string) => void;
  activarVersionPrompt: (id: string) => void;

  // Proyectos
  agregarProyecto: (p: Omit<Proyecto, "id" | "usuarioId">) => Proyecto;
  actualizarProyecto: (id: string, p: Omit<Proyecto, "id" | "usuarioId">) => void;
  eliminarProyecto: (id: string) => void;

  // Postulaciones
  crearPostulacion: (convocatoriaId: string, proyectoId: string | null) => Postulacion;
  toggleChecklistItem: (postulacionId: string, itemId: string) => void;
  cambiarEstadoPostulacion: (postulacionId: string, nuevoEstado: EstadoPostulacion) => void;
  vincularProyectoAPostulacion: (postulacionId: string, proyectoId: string) => void;

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
  crearEncargoEsperandoAsignacion: () => Encargo | null;
  crearEncargoDesdeDirectorio: (consultorId: string) => Encargo | null;

  // Encargos
  aceptarEncargo: (encargoId: string) => void;
  rechazarEncargoConsultor: (encargoId: string) => void;
  agregarAvanceEncargo: (encargoId: string, nota: string) => void;
  completarEncargo: (encargoId: string) => void;
  calificarEncargo: (encargoId: string, estrellas: number, comentario: string) => void;
  asignarConsultorInterno: (encargoId: string, consultorId: string) => void;

  // Perfiles de consultor
  actualizarPerfilConsultor: (consultorId: string, cambios: Partial<PerfilConsultor>) => void;
  enviarPerfilARevision: (consultorId: string) => void;
  aprobarPerfil: (consultorId: string) => void;
  rechazarPerfil: (consultorId: string, motivo: string) => void;
  suspenderConsultor: (consultorId: string) => void;
  reactivarConsultor: (consultorId: string) => void;
  agregarPortafolioItem: (consultorId: string, item: Omit<ItemPortafolio, "id">) => void;
  actualizarPortafolioItem: (consultorId: string, itemId: string, cambios: Partial<ItemPortafolio>) => void;
  eliminarPortafolioItem: (consultorId: string, itemId: string) => void;
  agregarRed: (consultorId: string, red: Omit<RedSocial, "id">) => void;
  actualizarRed: (consultorId: string, redId: string, cambios: Partial<RedSocial>) => void;
  eliminarRed: (consultorId: string, redId: string) => void;

  // Planes
  agregarPlan: (p: Omit<Plan, "id">) => void;
  actualizarPlan: (id: string, p: Omit<Plan, "id">) => void;
  eliminarPlan: (id: string) => void;

  // Suscripciones
  registrarPago: (suscripcionId: string, monto: number, fecha: string) => void;
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
  suscripciones: suscripcionesIniciales,
  pagos: pagosIniciales,
  documentos: documentosIniciales,
  promptVersiones: promptVersionesIniciales,
  estadisticasIA: estadisticasIAIniciales,
  eventosSeguridad: eventosSeguridadIniciales,

  modoDemo: "empresa_trial",
  setModoDemo: (modo) => set({ modoDemo: modo }),

  // -------------------------------------------------------------------------
  // Seguridad y auditoría (CU-38..40, RNF-25..28)
  // -------------------------------------------------------------------------

  mfaVerificado: false,
  verificarMFA: () => {
    set((s) => ({
      mfaVerificado: true,
      eventosSeguridad: [
        {
          id: nuevoId("evt"),
          tipo: "mfa_activado",
          usuarioNombre: "admin-1",
          ip: "192.168.1.20",
          ruta: "/admin/seguridad",
          detalle: "Verificación en dos pasos activada correctamente.",
          bloqueadoHasta: null,
          fecha: new Date().toISOString(),
        },
        ...s.eventosSeguridad,
      ],
    }));
  },
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

  simularPago: (usuarioId, planId, modalidad) => {
    set((s) => {
      const existente = s.suscripciones.find((sub) => sub.usuarioId === usuarioId);
      const monto =
        modalidad === "anual"
          ? s.planes.find((p) => p.id === planId)?.precioAnual ?? 0
          : s.planes.find((p) => p.id === planId)?.precioMensual ?? 0;
      const hoy = hoyIso();
      const nuevaFechaVencimiento = sumarPeriodo(hoy, modalidad);

      let suscripciones: Suscripcion[];
      let suscripcionId: string;
      if (existente) {
        suscripcionId = existente.id;
        suscripciones = s.suscripciones.map((sub) =>
          sub.id === existente.id
            ? {
                ...sub,
                planId,
                modalidad,
                estado: "activa",
                fechaInicio: hoy,
                fechaVencimiento: nuevaFechaVencimiento,
                creditosUsadosPeriodo: 0,
                periodoCreditosInicio: hoy,
              }
            : sub
        );
      } else {
        suscripcionId = nuevoId("sub");
        const nueva: Suscripcion = {
          id: suscripcionId,
          usuarioId,
          planId,
          modalidad,
          estado: "activa",
          fechaInicio: hoy,
          fechaVencimiento: nuevaFechaVencimiento,
          creditosUsadosPeriodo: 0,
          creditosExtra: 0,
          periodoCreditosInicio: hoy,
        };
        suscripciones = [...s.suscripciones, nueva];
      }

      const pago: Pago = { id: nuevoId("pago"), suscripcionId, monto, fecha: hoy };

      return { suscripciones, pagos: [...s.pagos, pago], modalSuscripcionAbierto: false };
    });
  },

  // RN-30: el propietario lo fija la sesión, nunca el formulario, y solo el
  // dueño edita o elimina.
  agregarProyecto: (p) => {
    const nuevo: Proyecto = { ...p, id: nuevoId("proy"), usuarioId: usuarioSesion(get().modoDemo) };
    set((s) => ({ proyectos: [...s.proyectos, nuevo] }));
    return nuevo;
  },
  actualizarProyecto: (id, p) => {
    const usuarioId = usuarioSesion(get().modoDemo);
    set((s) => ({
      proyectos: s.proyectos.map((pr) =>
        pr.id === id && pr.usuarioId === usuarioId ? { ...pr, ...p, usuarioId: pr.usuarioId } : pr
      ),
    }));
  },
  eliminarProyecto: (id) => {
    const usuarioId = usuarioSesion(get().modoDemo);
    set((s) => ({ proyectos: s.proyectos.filter((p) => !(p.id === id && p.usuarioId === usuarioId)) }));
  },

  crearPostulacion: (convocatoriaId, proyectoId) => {
    const convocatoria = get().convocatorias.find((c) => c.id === convocatoriaId);
    const checklist: ChecklistItem[] = (convocatoria?.requisitos ?? []).map((r) => ({
      id: nuevoId("chk"),
      descripcion: r.descripcion,
      obligatorio: r.obligatorio,
      completado: false,
    }));
    const nueva: Postulacion = {
      id: nuevoId("post"),
      usuarioId: usuarioSesion(get().modoDemo),
      convocatoriaId,
      proyectoId,
      estado: "en_preparacion",
      checklist,
      historial: [
        { id: nuevoId("hist"), estadoAnterior: null, estadoNuevo: "en_preparacion", fecha: hoyIso() },
      ],
    };
    set((s) => ({ postulaciones: [...s.postulaciones, nueva] }));
    return nueva;
  },

  toggleChecklistItem: (postulacionId, itemId) => {
    const usuarioId = usuarioSesion(get().modoDemo);
    set((s) => ({
      postulaciones: s.postulaciones.map((p) =>
        p.id === postulacionId && p.usuarioId === usuarioId
          ? {
              ...p,
              checklist: p.checklist.map((item) =>
                item.id === itemId ? { ...item, completado: !item.completado } : item
              ),
            }
          : p
      ),
    }));
  },

  cambiarEstadoPostulacion: (postulacionId, nuevoEstado) => {
    const usuarioId = usuarioSesion(get().modoDemo);
    set((s) => ({
      postulaciones: s.postulaciones.map((p) => {
        if (p.id !== postulacionId || p.usuarioId !== usuarioId || p.estado === nuevoEstado) return p;
        // RF-83: la transición se valida aquí, no solo en el selector. Al
        // conectar el backend esta comprobación se traslada a la API route.
        if (!transicionPermitida(p.estado, nuevoEstado)) return p;
        return {
          ...p,
          estado: nuevoEstado,
          historial: [
            ...p.historial,
            {
              id: nuevoId("hist"),
              estadoAnterior: p.estado,
              estadoNuevo: nuevoEstado,
              fecha: hoyIso(),
            },
          ],
        };
      }),
    }));
  },

  vincularProyectoAPostulacion: (postulacionId, proyectoId) => {
    const usuarioId = usuarioSesion(get().modoDemo);
    // RN-30: solo se vincula un proyecto propio a una postulación propia.
    const proyectoPropio = get().proyectos.some((pr) => pr.id === proyectoId && pr.usuarioId === usuarioId);
    if (!proyectoPropio) return;
    set((s) => ({
      postulaciones: s.postulaciones.map((p) =>
        p.id === postulacionId && p.usuarioId === usuarioId ? { ...p, proyectoId } : p
      ),
    }));
  },

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

  crearEncargoEsperandoAsignacion: () => {
    const solicitud = get().solicitudConsultorEnCurso;
    if (!solicitud) return null;
    const postulacion = solicitud.convocatoriaId
      ? postulacionParaProyectoConv(solicitud.proyectoId, solicitud.convocatoriaId, get().postulaciones)
      : undefined;
    const nuevo: Encargo = {
      id: nuevoId("encargo"),
      proyectoId: solicitud.proyectoId,
      empresaId: usuarioSesion(get().modoDemo),
      consultorId: null,
      tituloTarea: solicitud.tituloTarea,
      descripcionTarea: solicitud.descripcionTarea,
      via: "asignacion_interna",
      estado: "esperando_asignacion",
      avances: [],
      fechas: { creada: hoyIso(), aceptado: null, completado: null },
      tipoAyuda: solicitud.tipoAyuda,
      convocatoriaId: solicitud.convocatoriaId,
      postulacionId: postulacion?.id ?? null,
    };
    set((s) => ({ encargos: [...s.encargos, nuevo], solicitudConsultorEnCurso: null }));
    return nuevo;
  },

  crearEncargoDesdeDirectorio: (consultorId) => {
    const solicitud = get().solicitudConsultorEnCurso;
    if (!solicitud) return null;
    const postulacion = solicitud.convocatoriaId
      ? postulacionParaProyectoConv(solicitud.proyectoId, solicitud.convocatoriaId, get().postulaciones)
      : undefined;
    const nuevo: Encargo = {
      id: nuevoId("encargo"),
      proyectoId: solicitud.proyectoId,
      empresaId: usuarioSesion(get().modoDemo),
      consultorId,
      tituloTarea: solicitud.tituloTarea,
      descripcionTarea: solicitud.descripcionTarea,
      via: "directorio",
      estado: "pendiente",
      avances: [],
      fechas: { creada: hoyIso(), aceptado: null, completado: null },
      tipoAyuda: solicitud.tipoAyuda,
      convocatoriaId: solicitud.convocatoriaId,
      postulacionId: postulacion?.id ?? null,
    };
    set((s) => ({ encargos: [...s.encargos, nuevo], solicitudConsultorEnCurso: null }));
    return nuevo;
  },

  // -------------------------------------------------------------------------
  // Encargos
  // -------------------------------------------------------------------------

  aceptarEncargo: (encargoId) => {
    set((s) => ({
      encargos: s.encargos.map((e) =>
        e.id === encargoId ? { ...e, estado: "en_curso" as EstadoEncargo, fechas: { ...e.fechas, aceptado: hoyIso() } } : e
      ),
    }));
  },
  rechazarEncargoConsultor: (encargoId) => {
    set((s) => ({
      encargos: s.encargos.map((e) => (e.id === encargoId ? { ...e, estado: "rechazado" as EstadoEncargo } : e)),
    }));
  },
  agregarAvanceEncargo: (encargoId, nota) => {
    if (!nota.trim()) return;
    set((s) => ({
      encargos: s.encargos.map((e) =>
        e.id === encargoId
          ? { ...e, avances: [...e.avances, { id: nuevoId("avance"), nota: nota.trim(), fecha: hoyIso() }] }
          : e
      ),
    }));
  },
  completarEncargo: (encargoId) => {
    set((s) => {
      const encargo = s.encargos.find((e) => e.id === encargoId);
      const yaCompletado = !encargo || encargo.estado === "completado" || encargo.estado === "calificado";
      return {
      // RF-33: la trayectoria del consultor la marca haber completado el
      // encargo. La calificación es potestad de la empresa y puede no llegar
      // nunca; antes el contador dependía de ella y subestimaba su historial.
      consultores: s.consultores.map((c) =>
        !yaCompletado && encargo?.consultorId === c.id
          ? { ...c, totalEncargosCompletados: c.totalEncargosCompletados + 1 }
          : c
      ),
      encargos: s.encargos.map((e) =>
        e.id === encargoId
          ? { ...e, estado: "completado" as EstadoEncargo, fechas: { ...e.fechas, completado: hoyIso() } }
          : e
      ),
      };
    });
  },
  calificarEncargo: (encargoId, estrellas, comentario) => {
    set((s) => {
      const encargo = s.encargos.find((e) => e.id === encargoId);
      if (!encargo || !encargo.consultorId) return s;
      const yaCalificado = s.calificaciones.some((c) => c.encargoId === encargoId);
      if (yaCalificado) return s;

      const nuevaCalificacion: Calificacion = {
        id: nuevoId("calif"),
        encargoId,
        consultorId: encargo.consultorId,
        estrellas,
        comentario: comentario.trim(),
        fecha: hoyIso(),
      };
      const calificaciones = [...s.calificaciones, nuevaCalificacion];
      const delConsultor = calificaciones.filter((c) => c.consultorId === encargo.consultorId);
      const promedio = delConsultor.reduce((acc, c) => acc + c.estrellas, 0) / delConsultor.length;

      // El contador de completados ya avanzó al completar el encargo (RF-33):
      // aquí solo se recalcula el promedio.
      const consultores = s.consultores.map((c) =>
        c.id === encargo.consultorId
          ? { ...c, ratingPromedio: Math.round(promedio * 10) / 10 }
          : c
      );

      const encargos = s.encargos.map((e) =>
        e.id === encargoId ? { ...e, estado: "calificado" as EstadoEncargo } : e
      );

      return { calificaciones, consultores, encargos };
    });
  },
  asignarConsultorInterno: (encargoId, consultorId) => {
    set((s) => ({
      encargos: s.encargos.map((e) =>
        e.id === encargoId
          ? { ...e, consultorId, estado: "en_curso" as EstadoEncargo, fechas: { ...e.fechas, aceptado: hoyIso() } }
          : e
      ),
    }));
  },

  // -------------------------------------------------------------------------
  // Perfiles de consultor
  // -------------------------------------------------------------------------

  actualizarPerfilConsultor: (consultorId, cambios) => {
    set((s) => ({
      consultores: s.consultores.map((c) => (c.id === consultorId ? { ...c, ...cambios } : c)),
    }));
  },
  enviarPerfilARevision: (consultorId) => {
    set((s) => ({
      consultores: s.consultores.map((c) =>
        c.id === consultorId ? { ...c, estadoPerfil: "en_revision", motivoRechazo: undefined } : c
      ),
    }));
  },
  aprobarPerfil: (consultorId) => {
    set((s) => ({
      consultores: s.consultores.map((c) =>
        c.id === consultorId ? { ...c, estadoPerfil: "aprobado", motivoRechazo: undefined } : c
      ),
    }));
  },
  rechazarPerfil: (consultorId, motivo) => {
    set((s) => ({
      consultores: s.consultores.map((c) =>
        c.id === consultorId ? { ...c, estadoPerfil: "rechazado", motivoRechazo: motivo } : c
      ),
    }));
  },
  suspenderConsultor: (consultorId) => {
    // RN-29 (nuevo v5): al suspender, sus encargos en_curso se cancelan de
    // inmediato con motivo registrado — el historial y calificaciones ya
    // emitidas no se tocan.
    set((s) => ({
      consultores: s.consultores.map((c) => (c.id === consultorId ? { ...c, estadoPerfil: "suspendido" } : c)),
      encargos: s.encargos.map((e) =>
        e.consultorId === consultorId && e.estado === "en_curso"
          ? { ...e, estado: "cancelado" as EstadoEncargo, motivoCancelacion: "Consultor suspendido por el administrador" }
          : e
      ),
    }));
  },
  reactivarConsultor: (consultorId) => {
    set((s) => ({
      consultores: s.consultores.map((c) => (c.id === consultorId ? { ...c, estadoPerfil: "aprobado" } : c)),
    }));
  },
  agregarPortafolioItem: (consultorId, item) => {
    set((s) => ({
      consultores: s.consultores.map((c) =>
        c.id === consultorId ? { ...c, portafolio: [...c.portafolio, { ...item, id: nuevoId("port") }] } : c
      ),
    }));
  },
  actualizarPortafolioItem: (consultorId, itemId, cambios) => {
    set((s) => ({
      consultores: s.consultores.map((c) =>
        c.id === consultorId
          ? { ...c, portafolio: c.portafolio.map((it) => (it.id === itemId ? { ...it, ...cambios } : it)) }
          : c
      ),
    }));
  },
  eliminarPortafolioItem: (consultorId, itemId) => {
    set((s) => ({
      consultores: s.consultores.map((c) =>
        c.id === consultorId ? { ...c, portafolio: c.portafolio.filter((it) => it.id !== itemId) } : c
      ),
    }));
  },
  agregarRed: (consultorId, red) => {
    set((s) => ({
      consultores: s.consultores.map((c) =>
        c.id === consultorId ? { ...c, redes: [...c.redes, { ...red, id: nuevoId("red") }] } : c
      ),
    }));
  },
  actualizarRed: (consultorId, redId, cambios) => {
    set((s) => ({
      consultores: s.consultores.map((c) =>
        c.id === consultorId
          ? { ...c, redes: c.redes.map((r) => (r.id === redId ? { ...r, ...cambios } : r)) }
          : c
      ),
    }));
  },
  eliminarRed: (consultorId, redId) => {
    set((s) => ({
      consultores: s.consultores.map((c) =>
        c.id === consultorId ? { ...c, redes: c.redes.filter((r) => r.id !== redId) } : c
      ),
    }));
  },

  // -------------------------------------------------------------------------
  // Planes
  // -------------------------------------------------------------------------

  agregarPlan: (p) => {
    set((s) => ({ planes: [...s.planes, { ...p, id: nuevoId("plan") }] }));
  },
  actualizarPlan: (id, p) => {
    set((s) => ({ planes: s.planes.map((pl) => (pl.id === id ? { ...pl, ...p } : pl)) }));
  },
  eliminarPlan: (id) => {
    set((s) => ({ planes: s.planes.filter((p) => p.id !== id) }));
  },

  // -------------------------------------------------------------------------
  // Suscripciones
  // -------------------------------------------------------------------------

  registrarPago: (suscripcionId, monto, fecha) => {
    set((s) => {
      const suscripcion = s.suscripciones.find((sub) => sub.id === suscripcionId);
      if (!suscripcion) return s;
      const baseVencimiento = suscripcion.fechaVencimiento > fecha ? suscripcion.fechaVencimiento : fecha;
      const nuevaFechaVencimiento = sumarPeriodo(baseVencimiento, suscripcion.modalidad === "trial" ? "mensual" : suscripcion.modalidad);
      const pago: Pago = { id: nuevoId("pago"), suscripcionId, monto, fecha };
      return {
        pagos: [...s.pagos, pago],
        suscripciones: s.suscripciones.map((sub) =>
          sub.id === suscripcionId
            ? {
                ...sub,
                estado: "activa",
                fechaVencimiento: nuevaFechaVencimiento,
                creditosUsadosPeriodo: 0,
                periodoCreditosInicio: fecha,
              }
            : sub
        ),
      };
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

  otorgarCreditosExtra: (suscripcionId, cantidad) => {
    set((s) => ({
      suscripciones: s.suscripciones.map((sub) =>
        sub.id === suscripcionId ? { ...sub, creditosExtra: sub.creditosExtra + cantidad } : sub
      ),
    }));
  },

  comprarPaqueteCreditos: (usuarioId) => {
    set((s) => {
      const suscripcion = s.suscripciones.find((sub) => sub.usuarioId === usuarioId);
      if (!suscripcion) return s;
      const pago: Pago = { id: nuevoId("pago"), suscripcionId: suscripcion.id, monto: PAQUETE_CREDITOS_PRECIO, fecha: hoyIso() };
      return {
        pagos: [...s.pagos, pago],
        suscripciones: s.suscripciones.map((sub) =>
          sub.id === suscripcion.id ? { ...sub, creditosExtra: sub.creditosExtra + PAQUETE_CREDITOS_CANTIDAD } : sub
        ),
        modalCreditosAbierto: false,
      };
    });
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
      usuarioId: proyecto?.usuarioId ?? usuarioSesion(get().modoDemo),
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

  // -------------------------------------------------------------------------
  // Plantillas de prompt (panel admin)
  // -------------------------------------------------------------------------

  agregarVersionPrompt: (contenido) => {
    set((s) => {
      const siguiente = Math.max(0, ...s.promptVersiones.map((p) => p.version)) + 1;
      const nueva: PromptVersion = {
        id: nuevoId("prompt"),
        version: siguiente,
        contenido,
        activa: false,
        fechaCreacion: hoyIso(),
      };
      return { promptVersiones: [...s.promptVersiones, nueva] };
    });
  },

  activarVersionPrompt: (id) => {
    set((s) => ({
      promptVersiones: s.promptVersiones.map((p) => ({ ...p, activa: p.id === id })),
    }));
  },
}));
