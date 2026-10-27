"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import { cn, diasRestantes, formatFecha, formatRangoCOP } from "@/lib/utils";
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
import type { Categoria, Convocatoria, TipoDocumento } from "@/lib/types";
import { ConvocatoriaCard } from "@/components/ConvocatoriaCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { DataTable } from "@/components/ui/DataTable";
import { DeadlineChip } from "@/components/viz/Deadline";

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
};

const CAMPO =
  "w-full rounded-lg border border-line bg-surface text-ink px-3 py-2 text-sm outline-none focus:border-pri ";

// RF-91: el consultor de un encargo "buscar convocatoria" usa la misma pantalla
// desde su encargo: `rutaFicha` lleva a la ficha de ese encargo y `soloVigentes`
// quita el filtro de cerradas, que él no ve.
export function CatalogoEmpresa({
  convocatorias: todas,
  categorias,
  rutaFicha,
  soloVigentes = false,
  titulo = "Convocatorias disponibles",
  busquedaInicial = "",
}: {
  convocatorias: Convocatoria[];
  categorias: Categoria[];
  rutaFicha?: (id: string) => string;
  soloVigentes?: boolean;
  titulo?: string;
  /** Búsqueda que llega de la barra superior (`/convocatorias?q=`). */
  busquedaInicial?: string;
}) {
  const tiposProyecto = useMemo(() => categorias.filter((c) => c.tipo === "tipo_proyecto"), [categorias]);
  const sectores = useMemo(() => categorias.filter((c) => c.tipo === "sector"), [categorias]);
  const tiposEntidad = useMemo(() => categorias.filter((c) => c.tipo === "tipo_entidad"), [categorias]);
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const [vista, setVista] = useState<"tarjetas" | "lista">("tarjetas");
  const router = useRouter();
  const [f, setF] = useState<Filtros>(SIN_FILTROS);
  const [orden, setOrden] = useState<ClaveOrden | "">("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(true);
  const set = <K extends keyof Filtros>(clave: K, valor: Filtros[K]) => setF((prev) => ({ ...prev, [clave]: valor }));
  const alternar = <K extends "tipoProyecto" | "sector" | "tipoEntidad" | "tipoDoc">(clave: K, valor: Filtros[K][number]) =>
    setF((prev) => {
      const lista = prev[clave] as string[];
      return { ...prev, [clave]: lista.includes(valor as string) ? lista.filter((v) => v !== valor) : [...lista, valor] };
    });

  const convocatorias = useMemo(
    () => (f.incluirCerradas ? todas : todas.filter((c) => c.estado !== "cerrada")),
    [todas, f.incluirCerradas]
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
    });
    // RF-94: sin orden elegido se conserva el del servidor.
    return orden ? ordenarCatalogo(filtradas, orden) : filtradas;
  }, [convocatorias, busqueda, f, orden, lecturaHasta, lecturaDesde, maxReq]);

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
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, categorias]);

  const limpiarFiltros = () => setF(SIN_FILTROS);

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

  const opcionesCategoria = (lista: Categoria[], clave: "tipoProyecto" | "sector" | "tipoEntidad") =>
    lista.map((cat) => (
      <Checkbox
        key={cat.id}
        label={cat.nombre}
        cuenta={porCategoria.get(cat.id) ?? 0}
        checked={f[clave].includes(cat.id)}
        onChange={() => alternar(clave, cat.id)}
      />
    ));

  return (
    <div>
      <PageHeader
        className="mb-6"
        titulo={titulo}
        descripcion={
          <span aria-live="polite">
            {resultados.length} {resultados.length === 1 ? "convocatoria encontrada" : "convocatorias encontradas"}
          </span>
        }
        accion={
          <Segmented
            etiqueta="Vista"
            valor={vista}
            onChange={setVista}
            opciones={[
              { valor: "tarjetas", titulo: "Tarjetas", etiqueta: <LayoutGrid className="h-4 w-4" aria-label="Tarjetas" /> },
              { valor: "lista", titulo: "Lista", etiqueta: <List className="h-4 w-4" aria-label="Lista" /> },
            ]}
          />
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, entidad o palabra clave..."
            aria-label="Buscar convocatorias"
            className="h-[42px] w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-4 text-[13.5px] text-ink outline-none placeholder:text-ink-3 focus:border-pri"
          />
        </div>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as ClaveOrden | "")}
          aria-label="Ordenar por"
          className="h-[42px] rounded-xl border border-line bg-surface px-3 text-[13.5px] text-ink outline-none focus:border-pri sm:w-56"
        >
          <option value="">Orden: el del catálogo</option>
          {ORDENES.map((o) => (
            <option key={o.clave} value={o.clave}>
              {o.nombre}
            </option>
          ))}
        </select>
        <Button variant={filtrosAbiertos ? "secondary" : "outline-amber"} size="md" onClick={() => setFiltrosAbiertos((v) => !v)} className="sm:w-auto">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros {activos.length > 0 && `(${activos.length})`}
        </Button>
      </div>

      {activos.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Filtros activos">
          {activos.map((a) => (
            <button
              key={a.clave}
              onClick={a.quitar}
              className="flex items-center gap-1 rounded-full bg-pri-soft py-1 pl-3 pr-2 text-xs font-medium text-pri-text ring-1 ring-inset ring-pri-soft hover:bg-pri-soft"
              title="Quitar este filtro"
            >
              {a.texto}
              <X className="h-3 w-3" aria-label="Quitar" />
            </button>
          ))}
          <button onClick={limpiarFiltros} className="text-xs font-semibold text-pri-text hover:underline">
            Limpiar todo
          </button>
        </div>
      )}

      {sugeridas.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-3">Prueba con:</span>
          {sugeridas.map((s) => (
            <button
              key={s.etiqueta}
              onClick={() => aplicarBusquedaSugerida(s)}
              className="rounded-full bg-pri-soft px-3 py-1.5 text-xs font-medium text-pri-text ring-1 ring-inset ring-pri-soft hover:bg-pri-soft"
            >
              {s.etiqueta}
            </button>
          ))}
        </div>
      )}

      <div className={cn("grid gap-8", filtrosAbiertos ? "lg:grid-cols-[300px_1fr]" : "grid-cols-1")}>
        {filtrosAbiertos && (
          <aside className="h-max rounded-2xl border border-line p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto bg-surface shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-ink">Filtros</h2>
              {activos.length > 0 && (
                <button onClick={limpiarFiltros} className="flex items-center gap-1 text-xs font-semibold text-pri-text hover:underline">
                  <X className="h-3 w-3" /> Limpiar
                </button>
              )}
            </div>

            <FiltroGrupo titulo="Tipo de proyecto" abierto>{opcionesCategoria(tiposProyecto, "tipoProyecto")}</FiltroGrupo>
            <FiltroGrupo titulo="Sector" abierto>{opcionesCategoria(sectores, "sector")}</FiltroGrupo>
            <FiltroGrupo titulo="Quién puede postular">{opcionesCategoria(tiposEntidad, "tipoEntidad")}</FiltroGrupo>

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

            <FiltroGrupo titulo="Monto">
              <CampoMonto etiqueta="Monto mínimo exigido hasta" valor={f.montoHasta} onChange={(v) => set("montoHasta", v)} lectura={lecturaHasta} />
              <CampoMonto etiqueta="Apoya con al menos" valor={f.montoDesde} onChange={(v) => set("montoDesde", v)} lectura={lecturaDesde} />
              <select value={f.monto} onChange={(e) => set("monto", e.target.value as FiltroMonto | "")} aria-label="Monto informado" className={CAMPO}>
                <option value="">Con o sin monto informado</option>
                <option value="con">Solo con monto informado</option>
                <option value="sin">Sin monto (apoyo no monetario o no informado)</option>
              </select>
            </FiltroGrupo>

            <FiltroGrupo titulo="Fecha de cierre">
              <div className="flex flex-wrap gap-1.5">
                {DIAS_CIERRE.map((d) => (
                  <button
                    key={d}
                    onClick={() => set("cierraEnDias", f.cierraEnDias === d ? null : d)}
                    aria-pressed={f.cierraEnDias === d}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                      f.cierraEnDias === d ? "bg-pri text-on-pri ring-pri" : "bg-surface text-ink-2 ring-line hover:bg-pri-soft"
                    )}
                  >
                    {d} días
                  </button>
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

            <FiltroGrupo titulo="Documentos y requisitos" ultimo={soloVigentes}>
              {TIPOS_DOCUMENTO.map((t) => (
                <Checkbox key={t.clave} label={t.nombre} checked={f.tipoDoc.includes(t.clave)} onChange={() => alternar("tipoDoc", t.clave)} />
              ))}
              <Checkbox label="Exige documentos entre sus requisitos" checked={f.exigeDocumentos} onChange={() => set("exigeDocumentos", !f.exigeDocumentos)} />
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

            {/* RF-11 / RN-02: las cerradas solo entran bajo petición explícita. */}
            {!soloVigentes && (
              <FiltroGrupo titulo="Convocatorias cerradas" ultimo abierto>
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" checked={f.incluirCerradas} onChange={(e) => set("incluirCerradas", e.target.checked)} className="mt-0.5" />
                  <span>
                    <span className="block text-sm text-ink">Incluirlas en los resultados</span>
                    <span className="block text-xs text-ink-3">
                      Sirven de referencia sobre lo que suele abrirse, pero ya no admiten postulación.
                    </span>
                  </span>
                </label>
              </FiltroGrupo>
            )}
          </aside>
        )}

        <div>
          {resultados.length === 0 ? (
            <EmptyState
              icon={Search}
              titulo="No encontramos convocatorias con esos filtros"
              descripcion="Prueba ajustando los filtros o la búsqueda para ver más resultados."
              accion={
                <div className="flex flex-col items-center gap-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      limpiarFiltros();
                      setBusqueda("");
                    }}
                  >
                    Limpiar filtros
                  </Button>
                  <div className="flex flex-wrap justify-center gap-2">
                    {sugeridas.map((s) => (
                      <button
                        key={s.etiqueta}
                        onClick={() => aplicarBusquedaSugerida(s)}
                        className="rounded-full bg-pri-soft px-3 py-1.5 text-xs font-medium text-pri-text ring-1 ring-inset ring-pri-soft hover:bg-pri-soft"
                      >
                        {s.etiqueta}
                      </button>
                    ))}
                  </div>
                </div>
              }
            />
          ) : (
            vista === "lista" ? (
              <DataTable
                etiqueta="Convocatorias"
                filas={resultados}
                clave={(c) => c.id}
                alHacerClic={(c) => router.push(rutaFicha?.(c.id) ?? `/convocatorias/${c.id}`)}
                columnas={[
                  {
                    clave: "nombre",
                    titulo: "Convocatoria",
                    ancho: "minmax(0,3fr)",
                    celda: (c) => (
                      <>
                        <span className="block truncate font-bold">{c.nombre}</span>
                        <span className="mt-0.5 block truncate text-xs text-ink-3">{c.entidadConvocante}</span>
                      </>
                    ),
                  },
                  {
                    clave: "monto",
                    titulo: "Monto",
                    ancho: "minmax(0,1.6fr)",
                    celda: (c) => <span className="font-tabular font-semibold">{formatRangoCOP(c.montoMin, c.montoMax)}</span>,
                  },
                  {
                    clave: "cierre",
                    titulo: "Cierre",
                    ancho: "150px",
                    celda: (c) => {
                      const d = diasRestantes(c.fechaCierre);
                      return d >= 0 && d < 15 && c.estado === "publicada" ? (
                        <DeadlineChip dias={d} />
                      ) : (
                        <span className="text-ink-2">{formatFecha(c.fechaCierre)}</span>
                      );
                    },
                  },
                ]}
              />
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                {resultados.map((c) => (
                  <ConvocatoriaCard key={c.id} convocatoria={c} categorias={categorias} href={rutaFicha?.(c.id)} />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function FiltroGrupo({
  titulo,
  children,
  ultimo,
  abierto,
}: {
  titulo: string;
  children: React.ReactNode;
  ultimo?: boolean;
  abierto?: boolean;
}) {
  return (
    <details open={abierto} className={cn("group mb-3 border-b border-line-2 pb-3", ultimo && "mb-0 border-b-0 pb-0")}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink-3">
        {titulo}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 space-y-2">{children}</div>
    </details>
  );
}

function Checkbox({ label, checked, onChange, cuenta }: { label: string; checked: boolean; onChange: () => void; cuenta?: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-line text-pri-text focus:ring-pri bg-surface text-ink" />
      <span className="flex-1">{label}</span>
      {cuenta !== undefined && <span className="text-xs text-ink-3">{cuenta}</span>}
    </label>
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
          className={cn(CAMPO, "pr-12")}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-3">COP</span>
      </div>
      {!lectura.ok && <p className="mt-1 text-xs text-sky-ink">El monto {lectura.error}</p>}
    </label>
  );
}
