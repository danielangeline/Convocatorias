"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { chipsSugeridos, filtrarCatalogo, type ChipSugerido } from "@/lib/catalogo-filtros";
import { leerMontoCOP } from "@/lib/montos";
import { DEPARTAMENTOS } from "@/lib/departamentos";
import type { Categoria, Convocatoria } from "@/lib/types";
import { ConvocatoriaCard } from "@/components/ConvocatoriaCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

// Sprint 2 paso 4: convocatorias y categorías son las reales, leídas en el
// servidor con la sesión de la empresa (RN-33) y recibidas como props: el store
// no sirve aquí, porque en el servidor solo tiene su estado inicial, que son
// datos de ejemplo (sesión 016). Aquí solo se filtra lo que ya se autorizó.

export function CatalogoEmpresa({ convocatorias: todas, categorias }: { convocatorias: Convocatoria[]; categorias: Categoria[] }) {
  const tiposProyecto = useMemo(() => categorias.filter((c) => c.tipo === "tipo_proyecto"), [categorias]);
  const sectores = useMemo(() => categorias.filter((c) => c.tipo === "sector"), [categorias]);
  const [busqueda, setBusqueda] = useState("");
  const [tipoProyectoSel, setTipoProyectoSel] = useState<string[]>([]);
  const [sectorSel, setSectorSel] = useState<string[]>([]);
  const [entidadSel, setEntidadSel] = useState<string>("");
  const [departamentoSel, setDepartamentoSel] = useState<string>("");
  const [montoHasta, setMontoHasta] = useState<string>("");
  const [cierraAntesDe, setCierraAntesDe] = useState<string>("");
  // RF-11 / RN-02: las cerradas salen del listado por defecto y solo
  // reaparecen bajo este filtro explícito, marcadas y sin acciones.
  const [incluirCerradas, setIncluirCerradas] = useState(false);
  const convocatorias = useMemo(
    () => (incluirCerradas ? todas : todas.filter((c) => c.estado !== "cerrada")),
    [todas, incluirCerradas]
  );
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(true);

  const entidades = useMemo(
    () => Array.from(new Set(convocatorias.map((c) => c.entidadConvocante))).sort(),
    [convocatorias]
  );
  // RF-43: derivados de lo vigente, así que ninguno lleva a un resultado vacío.
  // Los chips salen solo de lo vigente: una sugerencia que lleva a cerradas no ayuda.
  const sugeridas = useMemo(
    () => chipsSugeridos(todas.filter((c) => c.estado !== "cerrada"), categorias),
    [todas, categorias]
  );
  const lecturaMonto = leerMontoCOP(montoHasta);
  const montoValor = lecturaMonto.ok ? lecturaMonto.valor : null;

  const toggle = (lista: string[], valor: string, set: (v: string[]) => void) => {
    set(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
  };

  const resultados = useMemo(
    () =>
      filtrarCatalogo(convocatorias, {
        q: busqueda,
        tipoProyecto: tipoProyectoSel,
        sector: sectorSel,
        entidad: entidadSel,
        departamento: departamentoSel,
        montoHasta: montoValor,
        cierraAntesDe,
      }),
    [convocatorias, busqueda, tipoProyectoSel, sectorSel, entidadSel, departamentoSel, montoValor, cierraAntesDe]
  );

  const hayFiltrosActivos =
    tipoProyectoSel.length > 0 ||
    sectorSel.length > 0 ||
    !!entidadSel ||
    !!departamentoSel ||
    !!montoHasta ||
    !!cierraAntesDe ||
    incluirCerradas;

  const limpiarFiltros = () => {
    setTipoProyectoSel([]);
    setSectorSel([]);
    setEntidadSel("");
    setDepartamentoSel("");
    setMontoHasta("");
    setCierraAntesDe("");
    setIncluirCerradas(false);
  };

  const aplicarBusquedaSugerida = ({ filtros }: ChipSugerido) => {
    limpiarFiltros();
    setBusqueda(filtros.q ?? "");
    setTipoProyectoSel(filtros.tipoProyecto ?? []);
    setSectorSel(filtros.sector ?? []);
    setDepartamentoSel(filtros.departamento ?? "");
    setFiltrosAbiertos(true);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-ink">Convocatorias disponibles</h1>
        <p className="text-sm text-ink-soft">
          {resultados.length} {resultados.length === 1 ? "convocatoria encontrada" : "convocatorias encontradas"}
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, entidad o palabra clave..."
            className="w-full rounded-lg border border-line py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-ink-faint focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <Button
          variant={filtrosAbiertos ? "secondary" : "outline-gold"}
          size="md"
          onClick={() => setFiltrosAbiertos((v) => !v)}
          className="sm:w-auto"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros {hayFiltrosActivos && `(${tipoProyectoSel.length + sectorSel.length + [entidadSel, departamentoSel, montoHasta, cierraAntesDe, incluirCerradas].filter(Boolean).length})`}
        </Button>
      </div>

      {sugeridas.length > 0 && (
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink-faint">Prueba con:</span>
        {sugeridas.map((s) => (
          <button
            key={s.etiqueta}
            onClick={() => aplicarBusquedaSugerida(s)}
            className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-800 ring-1 ring-inset ring-primary-100 hover:bg-primary-100"
          >
            {s.etiqueta}
          </button>
        ))}
      </div>
      )}

      <div className={cn("grid gap-8", filtrosAbiertos ? "lg:grid-cols-[260px_1fr]" : "grid-cols-1")}>
        {filtrosAbiertos && (
          <aside className="h-max rounded-2xl border border-line p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-ink">Filtros</h2>
              {hayFiltrosActivos && (
                <button
                  onClick={limpiarFiltros}
                  className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                >
                  <X className="h-3 w-3" /> Limpiar
                </button>
              )}
            </div>

            <FiltroGrupo titulo="Tipo de proyecto">
              {tiposProyecto.map((cat) => (
                <Checkbox
                  key={cat.id}
                  label={cat.nombre}
                  checked={tipoProyectoSel.includes(cat.id)}
                  onChange={() => toggle(tipoProyectoSel, cat.id, setTipoProyectoSel)}
                />
              ))}
            </FiltroGrupo>

            <FiltroGrupo titulo="Sector">
              {sectores.map((cat) => (
                <Checkbox
                  key={cat.id}
                  label={cat.nombre}
                  checked={sectorSel.includes(cat.id)}
                  onChange={() => toggle(sectorSel, cat.id, setSectorSel)}
                />
              ))}
            </FiltroGrupo>

            <FiltroGrupo titulo="Entidad convocante">
              <select
                value={entidadSel}
                onChange={(e) => setEntidadSel(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
              >
                <option value="">Todas las entidades</option>
                {entidades.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </FiltroGrupo>

            {/* RF-12, RN-34: el departamento trae también las de cobertura nacional. */}
            <FiltroGrupo titulo="Departamento">
              <select
                value={departamentoSel}
                onChange={(e) => setDepartamentoSel(e.target.value)}
                aria-label="Departamento"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
              >
                <option value="">Todos los departamentos</option>
                {DEPARTAMENTOS.map((d) => (
                  <option key={d.codigo} value={d.codigo}>
                    {d.nombre}
                  </option>
                ))}
              </select>
              {departamentoSel && (
                <p className="mt-1.5 text-xs text-ink-faint">Incluye las convocatorias de cobertura nacional.</p>
              )}
            </FiltroGrupo>

            <FiltroGrupo titulo="Monto mínimo exigido hasta">
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={montoHasta}
                  onChange={(e) => setMontoHasta(e.target.value)}
                  placeholder="Ej. 100.000.000"
                  aria-invalid={!lecturaMonto.ok}
                  className="w-full rounded-lg border border-line px-3 py-2 pr-12 text-sm outline-none focus:border-primary-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">COP</span>
              </div>
              {!lecturaMonto.ok && <p className="mt-1 text-xs text-brick-700">El monto {lecturaMonto.error}</p>}
            </FiltroGrupo>

            <FiltroGrupo titulo="Fecha de cierre">
              <input
                type="date"
                value={cierraAntesDe}
                onChange={(e) => setCierraAntesDe(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
              <p className="mt-1 text-xs text-ink-faint">Mostrar convocatorias que cierran antes de esta fecha</p>
            </FiltroGrupo>

            {/* RF-11 / RN-02: las cerradas solo entran bajo petición explícita. */}
            <FiltroGrupo titulo="Convocatorias cerradas" ultimo>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={incluirCerradas}
                  onChange={(e) => setIncluirCerradas(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm text-ink">Incluirlas en los resultados</span>
                  <span className="block text-xs text-ink-faint">
                    Sirven de referencia sobre lo que suele abrirse, pero ya no admiten postulación.
                  </span>
                </span>
              </label>
            </FiltroGrupo>
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
                  <Button variant="secondary" size="sm" onClick={limpiarFiltros}>
                    Limpiar filtros
                  </Button>
                  <div className="flex flex-wrap justify-center gap-2">
                    {sugeridas.map((s) => (
                      <button
                        key={s.etiqueta}
                        onClick={() => aplicarBusquedaSugerida(s)}
                        className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-800 ring-1 ring-inset ring-primary-100 hover:bg-primary-100"
                      >
                        {s.etiqueta}
                      </button>
                    ))}
                  </div>
                </div>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {resultados.map((c) => (
                <ConvocatoriaCard key={c.id} convocatoria={c} categorias={categorias} />
              ))}
            </div>
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
}: {
  titulo: string;
  children: React.ReactNode;
  ultimo?: boolean;
}) {
  return (
    <div className={cn("mb-4 border-b border-line-soft pb-4", ultimo && "mb-0 border-b-0 pb-0")}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{titulo}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-line text-primary-700 focus:ring-primary-500"
      />
      {label}
    </label>
  );
}
