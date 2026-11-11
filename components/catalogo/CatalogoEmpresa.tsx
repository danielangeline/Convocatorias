"use client";

import { useMemo, useState } from "react";
import { Bookmark, ChevronDown, Search, SlidersHorizontal, WandSparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIAS_CIERRE,
  ORDENES,
  TIPOS_DOCUMENTO,
  chipsSugeridos,
  conteoPorCategoria,
  filtrarCatalogo,
  ordenarCatalogo,
  type Alcance,
  type ChipSugerido,
  type ClaveOrden,
  type FiltroMonto,
} from "@/lib/catalogo-filtros";
import { leerMontoCOP } from "@/lib/montos";
import { DEPARTAMENTOS, REGIONES, esCodigoDepartamento, nombreDepartamento, type ClaveRegion } from "@/lib/departamentos";
import type { Categoria, Convocatoria, OrigenConvocatoria, TipoConvocatoria, TipoDocumento } from "@/lib/types";
import { ConvocatoriaCard } from "@/components/ConvocatoriaCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FilaConvocatoria } from "./FilaConvocatoria";

// Sprint 2 paso 4: convocatorias y categorías son las reales, leídas en el
// servidor con la sesión de la empresa (RN-33) y recibidas como props: el store
// no sirve aquí, porque en el servidor solo tiene su estado inicial, que son
// datos de ejemplo (sesión 016). Aquí solo se filtra lo que ya se autorizó.
//
// Sesión 029 (RF-12, RF-94, RF-95): 20 filtros combinables, orden, etiquetas de
// los filtros activos y conteo por opción. Todo se calcula en el navegador
// sobre la lista ya autorizada, con el mismo módulo que usa el endpoint.

type Filtros = {
  tipoProyecto: string[];
  sector: string[];
  tipoEntidad: string[];
  entidad: string;
  departamento: string;
  region: ClaveRegion | "";
  alcance: Alcance | "";
  montoHasta: string;
  montoDesde: string;
  monto: FiltroMonto | "";
  cierraAntesDe: string;
  cierraDesde: string;
  cierraEnDias: number | null;
  anioCierre: string;
  abreDesde: string;
  tipoDoc: TipoDocumento[];
  exigeDocumentos: boolean;
  maxRequisitos: string;
  // RF-11 / RN-02: las cerradas salen del listado por defecto y solo
  // reaparecen bajo este filtro explícito, marcadas y sin acciones.
  incluirCerradas: boolean;
  // RN-39 (criterio 21 de RF-12): las convocatorias a las que el país de la
  // empresa no puede postularse solo entran bajo este filtro, marcadas.
  incluirOtrosPaises: boolean;
};

const SIN_FILTROS: Filtros = {
  tipoProyecto: [],
  sector: [],
  tipoEntidad: [],
  entidad: "",
  departamento: "",
  region: "",
  alcance: "",
  montoHasta: "",
  montoDesde: "",
  monto: "",
  cierraAntesDe: "",
  cierraDesde: "",
  cierraEnDias: null,
  anioCierre: "",
  abreDesde: "",
  tipoDoc: [],
  exigeDocumentos: false,
  maxRequisitos: "",
  incluirCerradas: false,
  incluirOtrosPaises: false,
};

const CAMPO =
  "min-h-11 w-full rounded-[4px] border border-line-strong bg-surface text-ink px-3 py-2 text-sm outline-none focus:border-pri focus:ring-2 focus:ring-pri-soft ";

/** Pestañas de la pantalla (`?tab=`): el catálogo, las sugeridas del cruce y las guardadas. */
export type PestanaCatalogo = "todas" | "sugeridas" | "guardadas";
/** Compatibilidad mínima de «Para mi perfil». */
const UMBRAL_PERFIL = 60;

// RF-91: el consultor de un encargo "buscar convocatoria" usa la misma pantalla
// desde su encargo: `rutaFicha` lleva a la ficha de ese encargo y `soloVigentes`
// quita el filtro de cerradas, que él no ve.
export function CatalogoEmpresa({
  convocatorias: todas,
  categorias,
  rutaFicha,
  soloVigentes = false,
  titulo = "Convocatorias",
  busquedaInicial = "",
  tipoInicial = "todas",
  compatibilidad,
  guardadas: guardadasIniciales,
  tabInicial = "todas",
  nuevasIds = [],
  proyectoPorConvocatoria,
  ultimoRastreo,
}: {
  convocatorias: Convocatoria[];
  categorias: Categoria[];
  rutaFicha?: (id: string) => string;
  soloVigentes?: boolean;
  titulo?: string;
  /** Búsqueda que llega de la barra superior (`/convocatorias?q=`). */
  busquedaInicial?: string;
  /** RF-102: tipo preseleccionado (`/convocatorias?tipo=`). */
  tipoInicial?: TipoConvocatoria | "todas";
  /** Porcentaje de compatibilidad por convocatoria (CU-10); sin él no hay anillo ni orden por compatibilidad. */
  compatibilidad?: Record<string, number>;
  /** RF-103: ids guardados; sin la prop no se ofrece guardar (p. ej. el consultor). */
  guardadas?: string[];
  /** Pestaña de arranque (`?tab=`); solo la empresa tiene pestañas. */
  tabInicial?: PestanaCatalogo;
  /** Convocatorias publicadas en los últimos 7 días (badge NUEVO y «nuevas esta semana»). */
  nuevasIds?: string[];
  /** Nombre del proyecto con el que mejor se cruzó cada convocatoria (pestaña Sugeridas). */
  proyectoPorConvocatoria?: Record<string, string>;
  /** Hora del último rastreo, cuando la fuente la informa; sin ella no se muestra nada. */
  ultimoRastreo?: string;
}) {
  const tiposProyecto = useMemo(() => categorias.filter((c) => c.tipo === "tipo_proyecto"), [categorias]);
  const sectores = useMemo(() => categorias.filter((c) => c.tipo === "sector"), [categorias]);
  const tiposEntidad = useMemo(() => categorias.filter((c) => c.tipo === "tipo_entidad"), [categorias]);
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const [f, setF] = useState<Filtros>(SIN_FILTROS);
  const [orden, setOrden] = useState<ClaveOrden | "">("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const conPestanas = guardadasIniciales !== undefined;
  const hayCompatibilidad = !!compatibilidad && Object.keys(compatibilidad).length > 0;
  const [tab, setTabEstado] = useState<PestanaCatalogo>(conPestanas ? tabInicial : "todas");
  // «Para mi perfil» arranca activo si hay con qué cruzar; una búsqueda o un tipo pedidos desde fuera lo apagan.
  const [perfil, setPerfil] = useState(() => hayCompatibilidad && tipoInicial === "todas" && !busquedaInicial && conPestanas);
  const nuevasSet = useMemo(() => new Set(nuevasIds), [nuevasIds]);
  const [tipo, setTipoEstado] = useState<TipoConvocatoria | "todas">(tipoInicial);
  const [origen, setOrigen] = useState<OrigenConvocatoria | "todos">("todos");
  const [guardadas, setGuardadas] = useState(() => new Set(guardadasIniciales ?? []));
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  // La dirección refleja el tipo (para el menú «Beneficios tributarios») sin recargar ni perder los filtros.
  const setTipo = (t: TipoConvocatoria | "todas") => {
    setTipoEstado(t);
    const url = new URL(window.location.href);
    if (t === "todas") url.searchParams.delete("tipo");
    else url.searchParams.set("tipo", t);
    window.history.replaceState(null, "", url.toString());
  };
  const cambiarTab = (t: PestanaCatalogo) => {
    setTabEstado(t);
    const url = new URL(window.location.href);
    if (t === "todas") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url.toString());
  };
  const alternarGuardada = async (id: string) => {
    const estaba = guardadas.has(id);
    setErrorGuardar(null);
    setGuardadas((prev) => {
      const n = new Set(prev);
      if (estaba) n.delete(id);
      else n.add(id);
      return n;
    });
    const r = await fetch(estaba ? `/api/guardadas/${id}` : "/api/guardadas", {
      method: estaba ? "DELETE" : "POST",
      headers: { "content-type": "application/json" },
      body: estaba ? undefined : JSON.stringify({ convocatoriaId: id }),
    }).catch(() => null);
    if (!r?.ok) {
      // El servidor manda: si falló, se deshace el cambio y se avisa.
      setGuardadas((prev) => {
        const n = new Set(prev);
        if (estaba) n.add(id);
        else n.delete(id);
        return n;
      });
      setErrorGuardar("No pudimos actualizar tus guardadas. Inténtalo otra vez.");
    }
  };
  const set = <K extends keyof Filtros>(clave: K, valor: Filtros[K]) => setF((prev) => ({ ...prev, [clave]: valor }));
  const alternar = <K extends "tipoProyecto" | "sector" | "tipoEntidad" | "tipoDoc">(clave: K, valor: Filtros[K][number]) =>
    setF((prev) => {
      const lista = prev[clave] as string[];
      return { ...prev, [clave]: lista.includes(valor as string) ? lista.filter((v) => v !== valor) : [...lista, valor] };
    });

  // RF-102: tipo y origen recortan el conjunto antes que los 20 filtros (sus conteos salen de lo que queda).
  const convocatorias = useMemo(
    () =>
      todas.filter(
        (c) =>
          (f.incluirCerradas || c.estado !== "cerrada") &&
          (f.incluirOtrosPaises || c.elegible !== false) &&
          (tipo === "todas" || (c.tipo ?? "fondo") === tipo) &&
          (origen === "todos" || (c.origen ?? "publico") === origen)
      ),
    [todas, f.incluirCerradas, f.incluirOtrosPaises, tipo, origen]
  );

  const entidades = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of convocatorias) m.set(c.entidadConvocante, (m.get(c.entidadConvocante) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [convocatorias]);
  // RF-95: cuántas convocatorias del conjunto cargado tiene cada opción.
  const porCategoria = useMemo(() => conteoPorCategoria(convocatorias), [convocatorias]);
  const porDepartamento = useMemo(() => {
    const nacionales = convocatorias.filter((c) => c.coberturaNacional).length;
    const m = new Map<string, number>();
    for (const d of DEPARTAMENTOS) m.set(d.codigo, nacionales);
    for (const c of convocatorias) if (!c.coberturaNacional) for (const d of new Set(c.departamentos)) m.set(d, (m.get(d) ?? 0) + 1);
    return m;
  }, [convocatorias]);
  const anios = useMemo(
    () => Array.from(new Set(convocatorias.map((c) => c.fechaCierre.slice(0, 4)))).sort(),
    [convocatorias]
  );

  // RF-43: derivados de lo vigente, así que ninguno lleva a un resultado vacío.
  // Los chips salen solo de lo vigente: una sugerencia que lleva a cerradas no ayuda.
  const sugeridas = useMemo(
    () => chipsSugeridos(todas.filter((c) => c.estado !== "cerrada"), categorias),
    [todas, categorias]
  );

  const lecturaHasta = leerMontoCOP(f.montoHasta);
  const lecturaDesde = leerMontoCOP(f.montoDesde);
  const maxReq = /^\d{1,3}$/.test(f.maxRequisitos) ? Number(f.maxRequisitos) : null;

  const resultados = useMemo(() => {
    const filtradas = filtrarCatalogo(convocatorias, {
      q: busqueda,
      tipoProyecto: f.tipoProyecto,
      sector: f.sector,
      tipoEntidad: f.tipoEntidad,
      entidad: f.entidad,
      departamento: f.departamento,
      region: f.region,
      alcance: f.alcance,
      montoHasta: lecturaHasta.ok ? lecturaHasta.valor : null,
      montoDesde: lecturaDesde.ok ? lecturaDesde.valor : null,
      monto: f.monto,
      cierraAntesDe: f.cierraAntesDe,
      cierraDesde: f.cierraDesde,
      cierraEnDias: f.cierraEnDias,
      anioCierre: f.anioCierre ? Number(f.anioCierre) : null,
      abreDesde: f.abreDesde,
      tipoDoc: f.tipoDoc,
      exigeDocumentos: f.exigeDocumentos,
      maxRequisitos: maxReq,
      incluirOtrosPaises: f.incluirOtrosPaises,
    });
    // RF-94: con orden elegido, ese; si no, por compatibilidad con los proyectos (CU-10)
    // cuando la hay, y si no, el del servidor.
    const delPerfil =
      perfil && compatibilidad ? filtradas.filter((c) => (compatibilidad[c.id] ?? -1) >= UMBRAL_PERFIL) : filtradas;
    if (orden) return ordenarCatalogo(delPerfil, orden);
    if (compatibilidad && Object.keys(compatibilidad).length > 0) {
      return [...delPerfil].sort((a, b) => (compatibilidad[b.id] ?? -1) - (compatibilidad[a.id] ?? -1));
    }
    return delPerfil;
  }, [convocatorias, busqueda, f, orden, lecturaHasta, lecturaDesde, maxReq, compatibilidad, perfil]);
  const porCompatibilidad = !orden && !!compatibilidad && Object.keys(compatibilidad).length > 0;

  // RF-95: cada filtro activo, con su valor y la forma de quitarlo.
  const nombreCategoria = (id: string) => categorias.find((c) => c.id === id)?.nombre ?? "Categoría";
  const activos = useMemo(() => {
    const a: { clave: string; texto: string; quitar: () => void }[] = [];
    for (const id of f.tipoProyecto) a.push({ clave: `tp-${id}`, texto: `Tipo: ${nombreCategoria(id)}`, quitar: () => alternar("tipoProyecto", id) });
    for (const id of f.sector) a.push({ clave: `se-${id}`, texto: `Sector: ${nombreCategoria(id)}`, quitar: () => alternar("sector", id) });
    for (const id of f.tipoEntidad) a.push({ clave: `te-${id}`, texto: `Postula: ${nombreCategoria(id)}`, quitar: () => alternar("tipoEntidad", id) });
    if (f.entidad) a.push({ clave: "entidad", texto: `Entidad: ${f.entidad}`, quitar: () => set("entidad", "") });
    if (f.departamento) a.push({ clave: "depto", texto: `Departamento: ${nombreDepartamento(f.departamento)}`, quitar: () => set("departamento", "") });
    if (f.region) a.push({ clave: "region", texto: `Región: ${REGIONES.find((r) => r.clave === f.region)?.nombre}`, quitar: () => set("region", "") });
    if (f.alcance) a.push({ clave: "alcance", texto: f.alcance === "nacional" ? "Solo nacionales" : "Solo territoriales", quitar: () => set("alcance", "") });
    if (f.montoHasta) a.push({ clave: "mh", texto: `Monto exigido hasta $${f.montoHasta}`, quitar: () => set("montoHasta", "") });
    if (f.montoDesde) a.push({ clave: "md", texto: `Apoyo desde $${f.montoDesde}`, quitar: () => set("montoDesde", "") });
    if (f.monto) a.push({ clave: "monto", texto: f.monto === "con" ? "Con monto informado" : "Sin monto informado", quitar: () => set("monto", "") });
    if (f.cierraEnDias) a.push({ clave: "dias", texto: `Cierra en ${f.cierraEnDias} días`, quitar: () => set("cierraEnDias", null) });
    if (f.anioCierre) a.push({ clave: "anio", texto: `Cierra en ${f.anioCierre}`, quitar: () => set("anioCierre", "") });
    if (f.cierraDesde) a.push({ clave: "cd", texto: `Cierra desde ${f.cierraDesde}`, quitar: () => set("cierraDesde", "") });
    if (f.cierraAntesDe) a.push({ clave: "ca", texto: `Cierra hasta ${f.cierraAntesDe}`, quitar: () => set("cierraAntesDe", "") });
    if (f.abreDesde) a.push({ clave: "ab", texto: `Abre desde ${f.abreDesde}`, quitar: () => set("abreDesde", "") });
    for (const t of f.tipoDoc) a.push({ clave: `td-${t}`, texto: `Documento: ${TIPOS_DOCUMENTO.find((x) => x.clave === t)?.nombre}`, quitar: () => alternar("tipoDoc", t) });
    if (f.exigeDocumentos) a.push({ clave: "ed", texto: "Exige documentos", quitar: () => set("exigeDocumentos", false) });
    if (f.maxRequisitos) a.push({ clave: "mr", texto: `Hasta ${f.maxRequisitos} requisitos`, quitar: () => set("maxRequisitos", "") });
    if (f.incluirCerradas) a.push({ clave: "cer", texto: "Incluye cerradas", quitar: () => set("incluirCerradas", false) });
    if (f.incluirOtrosPaises) a.push({ clave: "pai", texto: "Incluye otros países", quitar: () => set("incluirOtrosPaises", false) });
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, categorias]);

  const limpiarFiltros = () => {
    setF(SIN_FILTROS);
    setPerfil(false);
  };
  const limpiarTodo = () => {
    setF(SIN_FILTROS);
    setBusqueda("");
    setOrden("");
    setTipo("todas");
    setOrigen("todos");
    setPerfil(false);
  };

  // Atajos de un toque sobre lo que ya existe: compatibilidad (CU-10), cierre, tipo y origen.
  const chipsRapidos: { clave: string; etiqueta: string; activo: boolean; alternar: () => void }[] = [
    ...(conPestanas && hayCompatibilidad
      ? [{ clave: "perfil", etiqueta: "Para mi perfil", activo: perfil, alternar: () => setPerfil((v) => !v) }]
      : []),
    {
      clave: "cierre",
      etiqueta: "Cierran en 15 días",
      activo: f.cierraEnDias === 15,
      alternar: () => set("cierraEnDias", f.cierraEnDias === 15 ? null : 15),
    },
    {
      clave: "tributario",
      etiqueta: "Beneficio tributario",
      activo: tipo === "beneficio_tributario",
      alternar: () => setTipo(tipo === "beneficio_tributario" ? "todas" : "beneficio_tributario"),
    },
    {
      clave: "cooperacion",
      etiqueta: "Cooperación",
      activo: origen === "cooperacion",
      alternar: () => setOrigen(origen === "cooperacion" ? "todos" : "cooperacion"),
    },
  ];
  const nuevasSemana = useMemo(
    () => todas.filter((c) => nuevasSet.has(c.id) && c.estado !== "cerrada" && c.elegible !== false).length,
    [todas, nuevasSet]
  );

  const aplicarBusquedaSugerida = ({ filtros }: ChipSugerido) => {
    setF({
      ...SIN_FILTROS,
      tipoProyecto: filtros.tipoProyecto ?? [],
      sector: filtros.sector ?? [],
      departamento: filtros.departamento && esCodigoDepartamento(filtros.departamento) ? filtros.departamento : "",
    });
    setBusqueda(filtros.q ?? "");
    setFiltrosAbiertos(true);
  };

  const conteoFiltrosActivos = activos.length + (orden ? 1 : 0) + (tipo !== "todas" ? 1 : 0) + (origen !== "todos" ? 1 : 0);

  // Opciones de una categoría como botones de 38 px (activo: pri-soft con borde pri).
  const botonesCategoria = (lista: Categoria[], clave: "tipoProyecto" | "sector" | "tipoEntidad") => (
    <div className="flex flex-wrap gap-2">
      {lista.map((cat) => (
        <BotonOpcion
          key={cat.id}
          activo={f[clave].includes(cat.id)}
          onClick={() => alternar(clave, cat.id)}
          cuenta={porCategoria.get(cat.id) ?? 0}
        >
          {cat.nombre}
        </BotonOpcion>
      ))}
    </div>
  );

  const fila = (c: Convocatoria) => (
    <FilaConvocatoria
      key={c.id}
      convocatoria={c}
      href={rutaFicha?.(c.id) ?? `/convocatorias/${c.id}`}
      compatibilidad={compatibilidad?.[c.id]}
      nueva={nuevasSet.has(c.id)}
      guardada={guardadasIniciales ? guardadas.has(c.id) : undefined}
      onGuardar={guardadasIniciales ? () => alternarGuardada(c.id) : undefined}
    />
  );

  // Pestaña «Sugeridas»: tarjetas de las compatibles, de mayor a menor (CU-10, RN-05).
  const sugeridasLista = useMemo(
    () =>
      todas
        .filter((c) => compatibilidad?.[c.id] !== undefined && c.estado !== "cerrada" && c.elegible !== false)
        .sort((a, b) => (compatibilidad![b.id] ?? 0) - (compatibilidad![a.id] ?? 0)),
    [todas, compatibilidad]
  );
  const guardadasLista = useMemo(() => todas.filter((c) => guardadas.has(c.id)), [todas, guardadas]);

  const vacio = (
    <EmptyState
      icon={Search}
      titulo="No encontramos convocatorias con esos filtros"
      descripcion="Prueba ajustando los filtros o la búsqueda para ver más resultados."
      accion={
        <div className="flex flex-col items-center gap-4">
          <Button variant="secondary" onClick={limpiarTodo}>
            Limpiar filtros
          </Button>
          {sugeridas.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {sugeridas.map((s) => (
                <button
                  key={s.etiqueta}
                  onClick={() => aplicarBusquedaSugerida(s)}
                  className="min-h-11 cursor-pointer rounded-full bg-pri-soft px-3.5 text-xs font-semibold text-pri-text hover:underline"
                >
                  {s.etiqueta}
                </button>
              ))}
            </div>
          )}
        </div>
      }
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo={titulo}
        descripcion={
          ultimoRastreo
            ? `Fondos públicos, privados y de cooperación. Último rastreo: ${ultimoRastreo}.`
            : "Fondos públicos, privados y de cooperación para tu organización."
        }
      />

      {conPestanas && (
        <Tabs
          etiqueta="Vistas del catálogo"
          valor={tab}
          onChange={cambiarTab}
          pestanas={[
            { valor: "todas", etiqueta: "Todas", conteo: convocatorias.length },
            { valor: "sugeridas", etiqueta: "Sugeridas para ti", conteo: sugeridasLista.length },
            { valor: "guardadas", etiqueta: "Guardadas", conteo: guardadasLista.length },
          ]}
        />
      )}

      {tab === "todas" && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Busca por nombre, entidad o palabra clave"
                aria-label="Buscar convocatorias"
                className="h-12 w-full rounded-[4px] border border-line-strong bg-surface pl-10 pr-4 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-pri focus:ring-2 focus:ring-pri-soft"
              />
            </div>
            <Button variant="secondary" size="lg" onClick={() => setFiltrosAbiertos(true)} aria-haspopup="dialog">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {conteoFiltrosActivos > 0 && (
                <span className="font-tabular grid h-5 min-w-5 place-items-center rounded-full bg-pri px-1.5 text-[11px] text-on-pri">
                  {conteoFiltrosActivos}
                </span>
              )}
            </Button>
          </div>

          {/* Chips rápidos con desplazamiento horizontal. */}
          <div role="group" aria-label="Atajos" className="barra-desplazable -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {chipsRapidos.map((c) => (
              <button
                key={c.clave}
                type="button"
                aria-pressed={c.activo}
                onClick={c.alternar}
                className={cn(
                  "min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold transition-colors",
                  c.activo ? "border-pri bg-pri text-on-pri" : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2"
                )}
              >
                {c.etiqueta}
              </button>
            ))}
          </div>

          {errorGuardar && (
            <p role="alert" className="rounded-[4px] bg-rose-soft px-4 py-3 text-sm text-rose">
              {errorGuardar}
            </p>
          )}

          {activos.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
              {activos.map((a) => (
                <button
                  key={a.clave}
                  onClick={a.quitar}
                  className="flex min-h-9 cursor-pointer items-center gap-1 rounded-full bg-pri-soft py-1 pl-3 pr-2 text-xs font-semibold text-pri-text"
                  title="Quitar este filtro"
                >
                  {a.texto}
                  <X className="h-3 w-3" aria-label="Quitar" />
                </button>
              ))}
              <button onClick={limpiarFiltros} className="min-h-9 cursor-pointer text-xs font-semibold text-pri-text hover:underline">
                Limpiar todo
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
            <p aria-live="polite">
              <strong className="font-semibold text-ink">
                {resultados.length} {resultados.length === 1 ? "convocatoria coincide" : "convocatorias coinciden"}
              </strong>
              {porCompatibilidad && " · ordenadas por compatibilidad"}
            </p>
            {nuevasSemana > 0 && (
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
                <span aria-hidden className="relative h-2 w-2">
                  <span className="ping-ring absolute inset-0 rounded-full bg-amber" />
                  <span className="absolute inset-0 rounded-full bg-amber" />
                </span>
                {nuevasSemana} {nuevasSemana === 1 ? "nueva" : "nuevas"} esta semana
              </p>
            )}
          </div>

          {resultados.length === 0 ? vacio : <div className="flex flex-col gap-3">{resultados.map(fila)}</div>}
        </>
      )}

      {tab === "sugeridas" &&
        (sugeridasLista.length === 0 ? (
          <EmptyState
            icon={WandSparkles}
            titulo="Aún no hay convocatorias sugeridas"
            descripcion="Registra un proyecto o completa su tipo, sector, monto y departamento para que el cruce encuentre las que mejor le pegan."
            accion={<LinkButton href="/proyectos">Ir a mis proyectos</LinkButton>}
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4">
            {sugeridasLista.map((c) => (
              <ConvocatoriaCard
                key={c.id}
                convocatoria={c}
                categorias={categorias}
                href={rutaFicha?.(c.id)}
                compatibilidad={compatibilidad?.[c.id]}
                proyectoNombre={proyectoPorConvocatoria?.[c.id]}
                guardada={guardadas.has(c.id)}
                onGuardar={() => alternarGuardada(c.id)}
              />
            ))}
          </div>
        ))}

      {tab === "guardadas" &&
        (guardadasLista.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            titulo="Aún no guardas convocatorias"
            descripcion="En «Todas», toca el marcador de una convocatoria para tenerla a mano aquí. Si una cierra en los próximos 7 días, te avisamos en la campana."
            accion={<Button onClick={() => cambiarTab("todas")}>Explorar convocatorias</Button>}
          />
        ) : (
          <div className="flex flex-col gap-3">{guardadasLista.map(fila)}</div>
        ))}

      {/* Filtros: panel lateral de 420 px en escritorio y hoja inferior (86 %) en móvil. */}
      <BottomSheet
        abierto={filtrosAbiertos}
        onCerrar={() => setFiltrosAbiertos(false)}
        titulo="Filtros"
        lateralLg
        pie={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={limpiarTodo}>
              Limpiar
            </Button>
            <Button className="flex-1" onClick={() => setFiltrosAbiertos(false)}>
              Ver {resultados.length} {resultados.length === 1 ? "convocatoria" : "convocatorias"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5 p-5">
          {chipsRapidos.find((c) => c.clave === "perfil")?.activo && (
            <p className="rounded-[4px] bg-pri-soft px-3.5 py-3 text-[13px] leading-snug text-pri-text">
              Ya filtramos por tu perfil: solo ves las de 60 % o más de compatibilidad con alguno de tus proyectos. Ajusta
              solo si buscas algo distinto.
            </p>
          )}

          {!soloVigentes && (
            <FiltroGrupo titulo="Tipo de convocatoria" abierto>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["todas", "Todas"],
                    ["fondo", "Fondos y financiación"],
                    ["beneficio_tributario", "Beneficios tributarios"],
                  ] as const
                ).map(([valor, etiqueta]) => (
                  <BotonOpcion key={valor} activo={tipo === valor} onClick={() => setTipo(valor)}>
                    {etiqueta}
                  </BotonOpcion>
                ))}
              </div>
            </FiltroGrupo>
          )}
          <FiltroGrupo titulo="Origen" abierto>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["todos", "Todo origen"],
                  ["publico", "Público"],
                  ["privado", "Privado"],
                  ["cooperacion", "Cooperación"],
                ] as const
              ).map(([valor, etiqueta]) => (
                <BotonOpcion key={valor} activo={origen === valor} onClick={() => setOrigen(valor)}>
                  {etiqueta}
                </BotonOpcion>
              ))}
            </div>
          </FiltroGrupo>
          <FiltroGrupo titulo="Ordenar por" abierto>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as ClaveOrden | "")}
              aria-label="Ordenar por"
              className={CAMPO}
            >
              <option value="">El del catálogo</option>
              {ORDENES.map((o) => (
                <option key={o.clave} value={o.clave}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </FiltroGrupo>

          <FiltroGrupo titulo="Tipo de proyecto" abierto>{botonesCategoria(tiposProyecto, "tipoProyecto")}</FiltroGrupo>
          <FiltroGrupo titulo="Sector" abierto>{botonesCategoria(sectores, "sector")}</FiltroGrupo>
          <FiltroGrupo titulo="Quién puede postular">{botonesCategoria(tiposEntidad, "tipoEntidad")}</FiltroGrupo>

          <FiltroGrupo titulo="Entidad convocante">
            <select value={f.entidad} onChange={(e) => set("entidad", e.target.value)} aria-label="Entidad convocante" className={CAMPO}>
              <option value="">Todas las entidades</option>
              {entidades.map(([e, n]) => (
                <option key={e} value={e}>
                  {e} ({n})
                </option>
              ))}
            </select>
          </FiltroGrupo>

          {/* RF-12, RN-34: el departamento y la región traen también las de cobertura nacional. */}
          <FiltroGrupo titulo="Ubicación">
            <select value={f.departamento} onChange={(e) => set("departamento", e.target.value)} aria-label="Departamento" className={CAMPO}>
              <option value="">Todos los departamentos</option>
              {DEPARTAMENTOS.map((d) => (
                <option key={d.codigo} value={d.codigo}>
                  {d.nombre} ({porDepartamento.get(d.codigo) ?? 0})
                </option>
              ))}
            </select>
            <select value={f.region} onChange={(e) => set("region", e.target.value as ClaveRegion | "")} aria-label="Región" className={CAMPO}>
              <option value="">Todas las regiones</option>
              {REGIONES.map((r) => (
                <option key={r.clave} value={r.clave}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <select value={f.alcance} onChange={(e) => set("alcance", e.target.value as Alcance | "")} aria-label="Alcance" className={CAMPO}>
              <option value="">Nacionales y territoriales</option>
              <option value="nacional">Solo de cobertura nacional</option>
              <option value="territorial">Solo territoriales</option>
            </select>
            {(f.departamento || f.region) && f.alcance !== "territorial" && (
              <p className="text-xs text-ink-3">Incluye las convocatorias de cobertura nacional.</p>
            )}
          </FiltroGrupo>

          <FiltroGrupo titulo="Cuánto necesitas" abierto>
            <CampoMonto etiqueta="Busco apoyos de al menos" valor={f.montoDesde} onChange={(v) => set("montoDesde", v)} lectura={lecturaDesde} />
            <CampoMonto etiqueta="Que no exijan más de (monto mínimo)" valor={f.montoHasta} onChange={(v) => set("montoHasta", v)} lectura={lecturaHasta} />
            <select value={f.monto} onChange={(e) => set("monto", e.target.value as FiltroMonto | "")} aria-label="Monto informado" className={CAMPO}>
              <option value="">Con o sin monto informado</option>
              <option value="con">Solo con monto informado</option>
              <option value="sin">Sin monto (apoyo no monetario o no informado)</option>
            </select>
          </FiltroGrupo>

          <FiltroGrupo titulo="Fecha de cierre">
            <div className="flex flex-wrap gap-2">
              {DIAS_CIERRE.map((d) => (
                <BotonOpcion key={d} activo={f.cierraEnDias === d} onClick={() => set("cierraEnDias", f.cierraEnDias === d ? null : d)}>
                  {d} días
                </BotonOpcion>
              ))}
            </div>
            <p className="text-xs text-ink-3">Cierra en los próximos…</p>
            <select value={f.anioCierre} onChange={(e) => set("anioCierre", e.target.value)} aria-label="Año de cierre" className={CAMPO}>
              <option value="">Cualquier año</option>
              {anios.map((a) => (
                <option key={a} value={a}>
                  Cierra en {a}
                </option>
              ))}
            </select>
            <Fecha etiqueta="Cierra desde" valor={f.cierraDesde} onChange={(v) => set("cierraDesde", v)} />
            <Fecha etiqueta="Cierra antes de" valor={f.cierraAntesDe} onChange={(v) => set("cierraAntesDe", v)} />
          </FiltroGrupo>

          <FiltroGrupo titulo="Fecha de apertura">
            <Fecha etiqueta="Abre desde" valor={f.abreDesde} onChange={(v) => set("abreDesde", v)} />
            <p className="text-xs text-ink-3">Las que no informan su apertura no aparecen con este filtro.</p>
          </FiltroGrupo>

          <FiltroGrupo titulo="Documentos y requisitos">
            <div className="flex flex-wrap gap-2">
              {TIPOS_DOCUMENTO.map((t) => (
                <BotonOpcion key={t.clave} activo={f.tipoDoc.includes(t.clave)} onClick={() => alternar("tipoDoc", t.clave)}>
                  {t.nombre}
                </BotonOpcion>
              ))}
              <BotonOpcion activo={f.exigeDocumentos} onClick={() => set("exigeDocumentos", !f.exigeDocumentos)}>
                Exige documentos entre sus requisitos
              </BotonOpcion>
            </div>
            <label className="block text-xs text-ink-3">
              Hasta cuántos requisitos
              <input
                type="text"
                inputMode="numeric"
                value={f.maxRequisitos}
                onChange={(e) => set("maxRequisitos", e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="Ej. 5"
                className={cn(CAMPO, "mt-1")}
              />
            </label>
          </FiltroGrupo>

          {/* RN-39: las de otros países solo entran bajo petición explícita. */}
          {!soloVigentes && (
            <FiltroGrupo titulo="Otros países">
              <BotonOpcion activo={f.incluirOtrosPaises} onClick={() => set("incluirOtrosPaises", !f.incluirOtrosPaises)}>
                Incluir las de otros países
              </BotonOpcion>
              <p className="text-xs text-ink-3">
                Convocatorias a las que las organizaciones de tu país no pueden postularse. Se marcan y no admiten postulación.
              </p>
            </FiltroGrupo>
          )}

          {/* RF-11 / RN-02: las cerradas solo entran bajo petición explícita. */}
          {!soloVigentes && (
            <FiltroGrupo titulo="Convocatorias cerradas">
              <BotonOpcion activo={f.incluirCerradas} onClick={() => set("incluirCerradas", !f.incluirCerradas)}>
                Incluirlas en los resultados
              </BotonOpcion>
              <p className="text-xs text-ink-3">Sirven de referencia sobre lo que suele abrirse, pero ya no admiten postulación.</p>
            </FiltroGrupo>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}

function FiltroGrupo({ titulo, children, abierto }: { titulo: string; children: React.ReactNode; abierto?: boolean }) {
  return (
    <details open={abierto} className="group border-b border-line-2 pb-4 last:border-b-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-[.08em] text-ink-3">
        {titulo}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-1 space-y-2.5">{children}</div>
    </details>
  );
}

/** Opción de 38 px que reemplaza a la casilla: activa con `pri-soft` y borde `pri`. */
function BotonOpcion({
  activo,
  onClick,
  cuenta,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  cuenta?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-[4px] border px-3 text-[13px] font-medium transition-colors",
        activo ? "border-pri bg-pri-soft text-pri-text" : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2"
      )}
    >
      {children}
      {cuenta !== undefined && <span className="font-tabular text-xs text-ink-3">{cuenta}</span>}
    </button>
  );
}

function Fecha({ etiqueta, valor, onChange }: { etiqueta: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-ink-3">
      {etiqueta}
      <input type="date" value={valor} onChange={(e) => onChange(e.target.value)} className={cn(CAMPO, "mt-1")} />
    </label>
  );
}

function CampoMonto({
  etiqueta,
  valor,
  onChange,
  lectura,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  lectura: ReturnType<typeof leerMontoCOP>;
}) {
  return (
    <label className="block text-xs text-ink-3">
      {etiqueta}
      <div className="relative mt-1">
        <input
          type="text"
          inputMode="numeric"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ej. 100.000.000"
          aria-label={etiqueta}
          aria-invalid={!lectura.ok}
          className={cn(CAMPO, "font-tabular pr-12")}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-3">COP</span>
      </div>
      {!lectura.ok && <p className="mt-1 text-xs text-rose">El monto {lectura.error}</p>}
    </label>
  );
}
