"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2 } from "lucide-react";
import type { CategoriaAdmin, ConvocatoriaAdmin, FuenteAdmin, RequisitoAdmin, TipoCategoria, TipoRequisito } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { hoyColombia } from "@/lib/fechas";
import { formatearMontoCOP, leerMontoCOP } from "@/lib/montos";
import { DocumentosConvocatoria } from "./DocumentosConvocatoria";
import { cn, ESTADO_CONVOCATORIA_LABEL, ESTADO_CONVOCATORIA_ESTILO, TIPO_CATEGORIA_LABEL } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Aviso } from "@/components/identidad/Campo";
import { DEPARTAMENTOS } from "@/lib/departamentos";
import { formatMonto } from "@/lib/monedas";

type Opcion = { codigo: string; nombre: string };
/** Las monedas más usadas por las fuentes van primero en la lista (RN-40). */
const MONEDAS_FRECUENTES = ["COP", "USD", "EUR", "GBP", "CHF", "CAD"];

const PASOS = [
  { id: "paso-datos", etiqueta: "Datos generales" },
  { id: "paso-categorias", etiqueta: "Categorías" },
  { id: "paso-documentos", etiqueta: "Documentos" },
  { id: "paso-requisitos", etiqueta: "Requisitos" },
] as const;

const claseCampo =
  "min-h-11 w-full rounded-[4px] border border-line-strong bg-surface text-ink px-3 py-2 text-sm outline-none focus:border-pri focus:ring-2 focus:ring-pri-soft";
const tiposCategoria: TipoCategoria[] = ["tipo_proyecto", "sector", "tipo_entidad"];

// Clave local para la lista: los requisitos nuevos aún no tienen id.
type RequisitoEditable = RequisitoAdmin & { clave: string };

let contador = 0;
const nuevaClave = () => `nuevo-${++contador}`;

/**
 * CU-02 2a, CU-04 · Editor de una convocatoria del panel. Guarda datos,
 * categorías y requisitos juntos en el servidor, que valida todo (RF-05,
 * RF-06, RF-08, RNF-29) y devuelve la ficha guardada. No publica: RF-09.
 */
export function EditorConvocatoria({
  convocatoria,
  categorias,
  fuentes,
  paises,
  monedas,
}: {
  convocatoria: ConvocatoriaAdmin;
  categorias: CategoriaAdmin[];
  fuentes: FuenteAdmin[];
  /** RN-39: países ISO 3166-1 con su nombre. */
  paises: Opcion[];
  /** RN-40: monedas ISO 4217 con su nombre. */
  monedas: Opcion[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    fuenteId: convocatoria.fuenteId ?? "",
    nombre: convocatoria.nombre,
    entidadConvocante: convocatoria.entidadConvocante,
    descripcion: convocatoria.descripcion,
    ubicacion: convocatoria.ubicacion,
    urlPostulacion: convocatoria.urlPostulacion,
    tipo: convocatoria.tipo,
    origen: convocatoria.origen,
    montoMin: formatearMontoCOP(convocatoria.montoMin),
    montoMax: formatearMontoCOP(convocatoria.montoMax),
    moneda: convocatoria.moneda,
    fechaApertura: convocatoria.fechaApertura ?? "",
    fechaCierre: convocatoria.fechaCierre,
  });
  const [categoriasSel, setCategoriasSel] = useState<string[]>(convocatoria.categorias);
  // RN-39 · Países que pueden postularse: todos, o una lista. La cobertura en
  // departamentos solo aplica si Colombia es uno de ellos (RN-34).
  const [todosLosPaises, setTodosLosPaises] = useState(convocatoria.todosLosPaises);
  const [paisesSel, setPaisesSel] = useState<string[]>(convocatoria.paises);
  const [busquedaPais, setBusquedaPais] = useState("");
  const alternarPais = (codigo: string) =>
    setPaisesSel((prev) => (prev.includes(codigo) ? prev.filter((p) => p !== codigo) : [...prev, codigo]));
  const colombiaElegible = todosLosPaises || paisesSel.includes("CO");
  const nombrePais = new Map(paises.map((p) => [p.codigo, p.nombre]));
  const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const paisesBuscados = busquedaPais.trim()
    ? paises.filter((p) => !paisesSel.includes(p.codigo) && (sinTildes(p.nombre).includes(sinTildes(busquedaPais.trim())) || p.codigo === busquedaPais.trim().toUpperCase())).slice(0, 12)
    : [];
  const monedasOrdenadas = [
    ...MONEDAS_FRECUENTES.map((c) => monedas.find((m) => m.codigo === c)).filter((m): m is Opcion => !!m),
    ...monedas.filter((m) => !MONEDAS_FRECUENTES.includes(m.codigo)),
  ];
  // RN-34 · Cobertura: nacional, o uno o más departamentos de la lista oficial.
  const [coberturaNacional, setCoberturaNacional] = useState(convocatoria.coberturaNacional);
  const [departamentosSel, setDepartamentosSel] = useState<string[]>(convocatoria.departamentos);
  const alternarDepartamento = (codigo: string) =>
    setDepartamentosSel((prev) => (prev.includes(codigo) ? prev.filter((d) => d !== codigo) : [...prev, codigo]));
  const [requisitos, setRequisitos] = useState<RequisitoEditable[]>(() =>
    convocatoria.requisitos.map((r) => ({ ...r, clave: r.id ?? nuevaClave() }))
  );
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito" | "advertencia"; texto: string } | null>(null);
  const [avisoDocumentos, setAvisoDocumentos] = useState<string | null>(null);
  /** Cada acción nueva empieza sin los avisos de la anterior, sean de la ficha o de los documentos. */
  const limpiarAvisos = () => {
    setMensaje(null);
    setAvisoDocumentos(null);
  };
  const [guardando, setGuardando] = useState(false);
  const [paso, setPaso] = useState(0);
  const [estado, setEstado] = useState(convocatoria.estado);
  const [publicando, setPublicando] = useState(false);

  const campo = (nombre: keyof typeof form) => ({
    value: form[nombre],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [nombre]: e.target.value })),
  });

  // Se ofrecen las activas y las que ya tenía asignadas aunque se hayan desactivado.
  const fuentesOfrecidas = fuentes.filter((f) => f.activa || f.id === convocatoria.fuenteId);
  const categoriasOfrecidas = categorias.filter((c) => c.activa || convocatoria.categorias.includes(c.id));

  /** Envía el formulario y deja la pantalla al día. Devuelve si el guardado pasó y el aviso del servidor. */
  const enviarFormulario = async (): Promise<{ ok: boolean; aviso: string | null }> => {
    const r = await peticionAdmin<ConvocatoriaAdmin>(`/api/admin/convocatorias/${convocatoria.id}`, "PATCH", {
      ...form,
      categorias: categoriasSel,
      todosLosPaises,
      paises: todosLosPaises ? [] : paisesSel,
      coberturaNacional,
      departamentos: coberturaNacional ? [] : departamentosSel,
      requisitos: requisitos.map(({ id, descripcion, tipo, obligatorio }) => ({ id, descripcion, tipo, obligatorio })),
    });
    if (!r.ok) {
      setMensaje({ tipo: "error", texto: r.error });
      return { ok: false, aviso: null };
    }
    // Los requisitos nuevos reciben su id del servidor.
    setRequisitos(r.datos.requisitos.map((req) => ({ ...req, clave: req.id ?? nuevaClave() })));
    setEstado(r.datos.estado);
    return { ok: true, aviso: r.aviso };
  };

  const guardar = async () => {
    // CU-05 3e: una publicada con fecha ya pasada se permite, pero se advierte antes.
    if (
      estado === "publicada" &&
      form.fechaCierre &&
      form.fechaCierre < hoyColombia() &&
      !window.confirm(
        "La fecha de cierre ya pasó. Si guardas, la convocatoria seguirá publicada hasta la medianoche (hora de Colombia) y entonces se cerrará sola. Para retirarla ya, usa Despublicar. ¿Guardar de todos modos?"
      )
    ) {
      return false;
    }
    setGuardando(true);
    limpiarAvisos();
    const { ok, aviso } = await enviarFormulario();
    setGuardando(false);
    if (!ok) return false;
    setMensaje(aviso ? { tipo: "advertencia", texto: `Cambios guardados. ${aviso}` } : { tipo: "exito", texto: "Cambios guardados." });
    router.refresh();
    return true;
  };

  // Pasos numerados: cada uno es una sección de la ficha (anclas), no una pantalla aparte.
  const irAPaso = (n: number) => {
    const destino = Math.min(Math.max(n, 0), PASOS.length - 1);
    setPaso(destino);
    const reducido = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(PASOS[destino].id)?.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "start" });
  };
  const guardarYSeguir = async () => {
    if (await guardar()) irAPaso(paso + 1);
  };

  /**
   * CU-05 · Publicar y despublicar (RF-09).
   *
   * **Publicar guarda primero** lo que hay en el formulario y solo publica si
   * ese guardado pasa (CU-05 3d). Sin eso se publicaba lo último guardado
   * aunque en pantalla hubiera otra cosa, y el administrador no tenía forma de
   * notarlo. Qué falta para publicar lo decide y lo enumera el servidor
   * (RNF-20): aquí no se adelanta ningún juicio.
   */
  const cambiarPublicacion = async (publicar: boolean) => {
    setPublicando(true);
    limpiarAvisos();
    if (publicar && !(await enviarFormulario()).ok) {
      setPublicando(false);
      return;
    }
    const r = await peticionAdmin<ConvocatoriaAdmin>(
      `/api/admin/convocatorias/${convocatoria.id}/${publicar ? "publicar" : "despublicar"}`,
      "POST",
      {}
    );
    setPublicando(false);
    if (!r.ok) {
      setMensaje({ tipo: "error", texto: r.error });
      return;
    }
    setEstado(r.datos.estado);
    setMensaje({ tipo: "exito", texto: publicar ? "Convocatoria publicada." : "Convocatoria despublicada." });
    router.refresh();
  };

  const alternarCategoria = (id: string) =>
    setCategoriasSel((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const actualizarRequisito = (clave: string, cambios: Partial<RequisitoAdmin>) =>
    setRequisitos((prev) => prev.map((r) => (r.clave === clave ? { ...r, ...cambios } : r)));

  const moverRequisito = (indice: number, direccion: -1 | 1) =>
    setRequisitos((prev) => {
      const destino = indice + direccion;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });

  // Solo para la vista previa del rango: quien decide es el servidor (CU-02 2b).
  const lecturaMin = leerMontoCOP(form.montoMin);
  const lecturaMax = leerMontoCOP(form.montoMax);
  const montoMin = lecturaMin.ok ? lecturaMin.valor ?? 0 : 0;
  const montoMax = lecturaMax.ok ? lecturaMax.valor ?? 0 : 0;

  return (
    <div className="mx-auto w-full max-w-[760px] pb-24">
      <Link
        href="/admin/convocatorias"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-pri-text"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al listado
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge className={ESTADO_CONVOCATORIA_ESTILO[estado]}>{ESTADO_CONVOCATORIA_LABEL[estado]}</Badge>
          <h1 className="mt-2 font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink sm:text-[32px]">{form.nombre || "Convocatoria sin nombre"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {estado === "publicada" ? (
            <Button variant="secondary" onClick={() => cambiarPublicacion(false)} disabled={publicando}>
              {publicando ? "Despublicando…" : "Despublicar"}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => cambiarPublicacion(true)} disabled={publicando}>
              {publicando ? "Publicando…" : "Publicar"}
            </Button>
          )}
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {mensaje && (
        <div className="mb-6">
          {mensaje.tipo === "exito" ? (
            <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-pri-text">
              <CheckCircle2 className="h-4 w-4" /> {mensaje.texto}
            </p>
          ) : (
            <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>
          )}
        </div>
      )}

      <nav aria-label="Pasos de la ficha" className="sticky top-[60px] z-10 -mx-1 mb-6 overflow-x-auto bg-bg/95 px-1 py-3 backdrop-blur">
        <ol className="m-0 flex list-none gap-2 p-0">
          {PASOS.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => irAPaso(i)}
                aria-current={i === paso ? "step" : undefined}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border pl-2 pr-4 text-[13px] font-semibold transition-colors",
                  i === paso ? "border-pri bg-pri-soft text-pri-text" : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2"
                )}
              >
                <span
                  className={cn(
                    "font-tabular grid h-7 w-7 place-items-center rounded-full text-xs font-medium",
                    i === paso ? "bg-pri text-on-pri" : "bg-surface-2 text-ink-3"
                  )}
                >
                  {i + 1}
                </span>
                {p.etiqueta}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-6">
        <Seccion numero={1} id={PASOS[0].id} titulo="Datos generales">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            <Campo etiqueta="Nombre de la convocatoria" span2>
              <input {...campo("nombre")} className={claseCampo} required maxLength={300} />
            </Campo>
            <Campo etiqueta="Fuente">
              <select {...campo("fuenteId")} className={claseCampo}>
                <option value="">Sin fuente</option>
                {fuentesOfrecidas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                    {f.activa ? "" : " (inactiva)"}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Entidad convocante">
              <input {...campo("entidadConvocante")} className={claseCampo} required maxLength={200} />
            </Campo>
            <Campo etiqueta="Países que pueden postularse" span2>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={todosLosPaises}
                  onChange={(e) => setTodosLosPaises(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-pri-text bg-surface text-ink"
                />
                Todos los países
              </label>
              {!todosLosPaises && (
                <div className="mt-2">
                  <p className="mb-1.5 text-xs text-ink-3">
                    Solo los que la fuente nombra. Obligatorio para publicar. Las empresas solo ven por defecto las convocatorias a las que su país puede postularse.
                  </p>
                  {paisesSel.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {paisesSel.map((codigo) => (
                        <button
                          key={codigo}
                          type="button"
                          onClick={() => alternarPais(codigo)}
                          aria-label={`Quitar ${nombrePais.get(codigo) ?? codigo}`}
                          className="rounded-md bg-pri px-2.5 py-1 text-xs font-medium text-on-pri ring-1 ring-inset ring-pri"
                        >
                          {nombrePais.get(codigo) ?? codigo} ✕
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="search"
                    value={busquedaPais}
                    onChange={(e) => setBusquedaPais(e.target.value)}
                    placeholder="Buscar un país para agregarlo (p. ej. Colombia, Ecuador, MX)"
                    aria-label="Buscar país"
                    className={claseCampo}
                  />
                  {paisesBuscados.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {paisesBuscados.map((p) => (
                        <button
                          key={p.codigo}
                          type="button"
                          onClick={() => {
                            alternarPais(p.codigo);
                            setBusquedaPais("");
                          }}
                          className="rounded-md bg-surface px-2.5 py-1 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line hover:bg-surface-2"
                        >
                          + {p.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Campo>
            {colombiaElegible ? (
            <>
            <Campo etiqueta="Cobertura en Colombia" span2>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={coberturaNacional}
                  onChange={(e) => setCoberturaNacional(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-pri-text bg-surface text-ink"
                />
                Cobertura nacional
              </label>
              {!coberturaNacional && (
                <fieldset className="mt-2">
                  <legend className="mb-1.5 text-xs text-ink-3">
                    Departamentos que cubre{departamentosSel.length > 0 ? ` (${departamentosSel.length})` : ""}. Obligatorio para publicar si no es nacional.
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {DEPARTAMENTOS.map((d) => {
                      const activo = departamentosSel.includes(d.codigo);
                      return (
                        <button
                          key={d.codigo}
                          type="button"
                          onClick={() => alternarDepartamento(d.codigo)}
                          aria-pressed={activo}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                            activo
                              ? "bg-pri text-on-pri ring-pri"
                              : "bg-surface text-ink-2 ring-line hover:bg-surface-2"
                          )}
                        >
                          {d.nombre}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </Campo>
            <Campo etiqueta="Detalle de la cobertura (opcional)" span2>
              <input
                {...campo("ubicacion")}
                placeholder="Ej. municipios PDET, zona rural de Montes de María"
                className={claseCampo}
                maxLength={300}
              />
              <p className="mt-1 text-xs text-ink-3">Se muestra en la ficha; no se usa para filtrar ni para las sugerencias.</p>
            </Campo>
            </>
            ) : (
              <p className="text-xs text-ink-3 sm:col-span-2">
                Colombia no está entre los países elegibles: la cobertura por departamentos no aplica.
              </p>
            )}
            <Campo etiqueta="Tipo de convocatoria">
              <select {...campo("tipo")} className={claseCampo}>
                <option value="fondo">Fondos y financiación</option>
                <option value="beneficio_tributario">Beneficio tributario</option>
              </select>
            </Campo>
            <Campo etiqueta="Origen">
              <select {...campo("origen")} className={claseCampo}>
                <option value="publico">Público</option>
                <option value="privado">Privado</option>
                <option value="cooperacion">Cooperación internacional</option>
              </select>
            </Campo>
            <Campo etiqueta="Enlace oficial de postulación (URL del portal de la entidad)" span2>
              <input
                type="url"
                {...campo("urlPostulacion")}
                placeholder="https://entidad.gov.co/convocatoria"
                className={claseCampo}
              />
              <p className="mt-1 text-xs text-ink-3">
                Obligatorio para publicar: es donde la empresa radica su postulación, no en esta plataforma.
              </p>
            </Campo>
            <Campo etiqueta="Descripción u objeto" span2>
              <textarea {...campo("descripcion")} rows={4} className={`${claseCampo} resize-y`} maxLength={10000} />
            </Campo>
            <Campo etiqueta="Moneda del monto" span2>
              <select {...campo("moneda")} className={claseCampo}>
                {monedasOrdenadas.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.codigo} · {m.nombre}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-3">
                La de la fuente: el monto se guarda tal cual, sin convertir. Para comparar en pesos se usa la tasa de referencia del panel.
              </p>
            </Campo>
            <Campo etiqueta={`Monto mínimo (${form.moneda})`}>
              <input type="text" inputMode="numeric" placeholder="Ej. 50.000.000" {...campo("montoMin")} className={claseCampo} />
            </Campo>
            <Campo etiqueta={`Monto máximo (${form.moneda})`}>
              <input type="text" inputMode="numeric" placeholder="Ej. 500.000.000" {...campo("montoMax")} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Fecha de apertura">
              <input type="date" {...campo("fechaApertura")} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Fecha de cierre">
              <input type="date" {...campo("fechaCierre")} className={claseCampo} required />
            </Campo>
          </div>
          {montoMin > 0 && montoMax > 0 && (
            <p className="mt-2 font-tabular text-xs text-ink-3">
              Rango: {formatMonto(montoMin, form.moneda)} – {formatMonto(montoMax, form.moneda)}
            </p>
          )}
        </Seccion>

        <Seccion numero={2} id={PASOS[1].id} titulo="Categorías">
          {categoriasOfrecidas.length === 0 ? (
            <p className="text-sm text-ink-3">
              No hay categorías activas.{" "}
              <Link href="/admin/categorias" className="font-semibold text-pri-text hover:underline">
                Crear categorías
              </Link>
            </p>
          ) : (
            <div className="space-y-4">
              {tiposCategoria.map((tipo) => {
                const deTipo = categoriasOfrecidas.filter((c) => c.tipo === tipo);
                return (
                  <div key={tipo}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
                      {TIPO_CATEGORIA_LABEL[tipo]}
                    </p>
                    {deTipo.length === 0 ? (
                      <p className="text-xs text-ink-3">Sin categorías de este tipo.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {deTipo.map((c) => {
                          const activo = categoriasSel.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => alternarCategoria(c.id)}
                              aria-pressed={activo}
                              className={cn(
                                "rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                                activo
                                  ? "bg-pri text-on-pri ring-pri"
                                  : "bg-surface text-ink-2 ring-line hover:bg-surface-2"
                              )}
                            >
                              {c.nombre}
                              {c.activa ? "" : " (inactiva)"}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Seccion>

        <Seccion numero={3} id={PASOS[2].id} titulo="Documentos">
          <DocumentosConvocatoria
            convocatoriaId={convocatoria.id}
            documentos={convocatoria.documentos}
            error={avisoDocumentos}
            onError={(error) => (error === null ? limpiarAvisos() : setAvisoDocumentos(error))}
          />
        </Seccion>

        <Seccion
          numero={4}
          id={PASOS[3].id}
          titulo="Requisitos"
          accion={
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setRequisitos((prev) => [
                  ...prev,
                  { clave: nuevaClave(), descripcion: "", tipo: "documento", obligatorio: true },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" /> Agregar requisito
            </Button>
          }
        >
          {requisitos.length === 0 ? (
            <p className="text-sm text-ink-3">Aún no hay requisitos definidos.</p>
          ) : (
            <ol className="space-y-2">
              {requisitos.map((req, indice) => (
                <li key={req.clave} className="flex flex-wrap items-center gap-2 rounded-[4px] border border-line-2 px-3 py-2.5">
                  <span className="w-5 text-right font-tabular text-xs text-ink-3">{indice + 1}.</span>
                  <input
                    value={req.descripcion}
                    onChange={(e) => actualizarRequisito(req.clave, { descripcion: e.target.value })}
                    placeholder="Ej. Certificado de existencia y representación legal"
                    aria-label={`Descripción del requisito ${indice + 1}`}
                    maxLength={1000}
                    className="min-w-48 flex-1 rounded-[4px] border border-line px-3 py-1.5 text-sm outline-none focus:border-pri bg-surface text-ink"
                  />
                  <select
                    value={req.tipo}
                    onChange={(e) => actualizarRequisito(req.clave, { tipo: e.target.value as TipoRequisito })}
                    aria-label={`Tipo del requisito ${indice + 1}`}
                    className="rounded-[4px] border border-line px-2 py-1.5 text-sm outline-none focus:border-pri bg-surface text-ink"
                  >
                    <option value="documento">Documento</option>
                    <option value="condicion">Condición</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-ink-2">
                    <input
                      type="checkbox"
                      checked={req.obligatorio}
                      onChange={(e) => actualizarRequisito(req.clave, { obligatorio: e.target.checked })}
                      className="h-4 w-4 rounded border-line text-pri-text focus:ring-pri bg-surface text-ink"
                    />
                    Obligatorio
                  </label>
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moverRequisito(indice, -1)}
                      disabled={indice === 0}
                      aria-label="Subir"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moverRequisito(indice, 1)}
                      disabled={indice === requisitos.length - 1}
                      aria-label="Bajar"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRequisitos((prev) => prev.filter((r) => r.clave !== req.clave))}
                      className="text-rose hover:bg-rose-soft"
                      aria-label={`Quitar el requisito ${indice + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-ink-3">
            Quitar un requisito no cambia el checklist de las postulaciones ya iniciadas.
          </p>
        </Seccion>
      </div>

      {/* Pie fijo: cerrar sin guardar o guardar y pasar al paso siguiente. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface lg:left-[252px]">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-3 px-4 py-3 sm:px-7">
          <Link
            href="/admin/convocatorias"
            className="inline-flex min-h-11 items-center justify-center rounded-[4px] border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2"
          >
            Cerrar
          </Link>
          <Button variant="primary" onClick={guardarYSeguir} disabled={guardando}>
            {guardando ? "Guardando…" : paso >= PASOS.length - 1 ? "Guardar cambios" : "Guardar y seguir"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Seccion({
  titulo,
  children,
  accion,
  numero,
  id,
}: {
  titulo: string;
  children: React.ReactNode;
  accion?: React.ReactNode;
  numero?: number;
  id?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-titulo` : undefined} className="scroll-mt-32 rounded-md border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={id ? `${id}-titulo` : undefined} className="flex items-center gap-3 font-display text-xl font-semibold text-ink">
          {numero !== undefined && (
            <span className="font-tabular grid h-7 w-7 place-items-center rounded-full bg-pri-soft text-xs font-medium text-pri-text">{numero}</span>
          )}
          {titulo}
        </h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Campo({ etiqueta, children, span2 }: { etiqueta: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <label className={cn("block", span2 && "col-span-full")}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">{etiqueta}</span>
      {children}
    </label>
  );
}
