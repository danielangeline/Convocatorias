"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Check, X, FileText, Globe, Link2, UserRound, History } from "lucide-react";
import type { ConsultorAdmin } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Aviso } from "@/components/identidad/Campo";
import { ModalMotivo } from "./ModalMotivo";

const NOMBRE_RED = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", otra: "Otra red" } as const;

/**
 * Abre la hoja de vida por URL firmada de 15 minutos (CU-25 paso 2, RNF-16).
 * La pestaña se abre antes de pedir la URL: si se abriera después de esperar
 * la respuesta, el navegador la trataría como ventana emergente y la bloquearía.
 */
async function abrirHojaDeVida(id: string): Promise<string | null> {
  const pestana = window.open("", "_blank");
  try {
    const respuesta = await fetch(`/api/admin/consultores/${id}/cv`);
    const json = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !json.datos?.url) {
      pestana?.close();
      return json.error ?? "No pudimos abrir la hoja de vida. Intenta de nuevo.";
    }
    if (pestana) {
      pestana.opener = null;
      pestana.location.href = json.datos.url;
    } else {
      window.location.href = json.datos.url;
    }
    return null;
  } catch {
    pestana?.close();
    return "No hay conexión con el servidor. Intenta de nuevo.";
  }
}

/**
 * CU-25 · Bandeja de perfiles en revisión (RF-34). Aprobar o rechazar lo
 * valida la base, que además bloquea la fila: si otro administrador ya
 * actuó, responde 409 y la bandeja se recarga (CU-25 3a).
 */
export function BandejaRevision({ consultores }: { consultores: ConsultorAdmin[] }) {
  const router = useRouter();
  const [rechazando, setRechazando] = useState<ConsultorAdmin | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);

  const aprobar = async (c: ConsultorAdmin) => {
    setOcupado(c.id);
    setAviso(null);
    const r = await peticionAdmin(`/api/admin/consultores/${c.id}/aprobar`, "POST", {});
    setOcupado(null);
    setAviso(r.ok ? { tipo: "exito", texto: `${c.nombreProfesional}: ${r.aviso}` } : { tipo: "error", texto: r.error });
    router.refresh();
  };

  const rechazar = async (motivo: string) => {
    if (!rechazando) return;
    setOcupado(rechazando.id);
    setErrorModal(null);
    const r = await peticionAdmin(`/api/admin/consultores/${rechazando.id}/rechazar`, "POST", { motivo });
    setOcupado(null);
    if (!r.ok) {
      setErrorModal(r.error);
      return;
    }
    setAviso({ tipo: "exito", texto: `${rechazando.nombreProfesional}: ${r.aviso}` });
    setRechazando(null);
    router.refresh();
  };

  const verHojaDeVida = async (c: ConsultorAdmin) => {
    setAviso(null);
    const error = await abrirHojaDeVida(c.id);
    if (error) setAviso({ tipo: "error", texto: error });
  };

  // Lista a la izquierda y detalle a la derecha; el primero (el que más espera) arranca elegido.
  const elegido = consultores.find((c) => c.id === seleccionId) ?? consultores[0];
  const checklist = elegido
    ? [
        { etiqueta: "Foto de perfil", ok: !!elegido.fotoUrl },
        { etiqueta: "Descripción", ok: elegido.descripcion.trim().length > 0 },
        { etiqueta: "Al menos una especialidad", ok: elegido.especialidades.length > 0 },
        { etiqueta: "Hoja de vida en PDF", ok: elegido.tieneHojaDeVida },
        { etiqueta: "Portafolio con proyectos", ok: elegido.portafolio.length > 0 },
        { etiqueta: "Redes o sitio web", ok: elegido.redes.length > 0 || !!elegido.sitioWeb },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Perfiles en revisión"
        descripcion="Aprueba o rechaza los perfiles que los consultores enviaron. El que más lleva esperando va primero."
      />

      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      {consultores.length === 0 || !elegido ? (
        <EmptyState
          icon={UserCheck}
          titulo="No hay perfiles pendientes"
          descripcion="Cuando un consultor envíe su perfil a revisión aparecerá aquí."
        />
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <ul aria-label="Perfiles pendientes" className="m-0 flex min-w-0 flex-[1_1_280px] list-none flex-col gap-2 p-0 lg:max-w-[340px]">
            {consultores.map((c) => {
              const activo = c.id === elegido.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSeleccionId(c.id)}
                    aria-pressed={activo}
                    className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                      activo ? "border-pri bg-pri-soft" : "border-line bg-surface hover:bg-surface-2"
                    }`}
                  >
                    {c.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage, cambia en cada carga
                      <img src={c.fotoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-3">
                        <UserRound className="h-5 w-5" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{c.nombreProfesional}</span>
                      <span className="block text-xs text-ink-3">{c.motivoRechazo ? "Reenvío" : "Primera revisión"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <article key={elegido.id} className="min-w-0 flex-[2_1_440px] rounded-md border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {elegido.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage, cambia en cada carga
                  <img src={elegido.fotoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-line" />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-3 ring-1 ring-line">
                    <UserRound className="h-7 w-7" />
                  </span>
                )}
                <div>
                  <h2 className="font-display text-2xl font-semibold leading-tight text-ink">{elegido.nombreProfesional}</h2>
                  {elegido.sitioWeb && (
                    <a
                      href={elegido.sitioWeb}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 flex items-center gap-1 text-xs text-pri-text hover:underline"
                    >
                      <Globe className="h-3 w-3" /> {elegido.sitioWeb}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {elegido.motivoRechazo && (
              <div className="mt-4 flex items-start gap-2 rounded-[4px] bg-amber-soft px-4 py-3 text-sm text-ink">
                <History className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  <span className="font-semibold">Reenvío.</span> Motivo del rechazo anterior: {elegido.motivoRechazo}
                </p>
              </div>
            )}

            {/* Checklist de revisión: lo mínimo que la base exige y lo que ayuda a decidir. */}
            <section aria-labelledby="check-revision" className="mt-5 rounded-md bg-surface-2 p-4">
              <h3 id="check-revision" className="text-xs font-semibold uppercase tracking-[.08em] text-ink-3">
                Checklist de revisión
              </h3>
              <ul className="m-0 mt-2 grid list-none gap-1.5 p-0 sm:grid-cols-2">
                {checklist.map((i) => (
                  <li key={i.etiqueta} className="flex items-center gap-2 text-sm text-ink">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${i.ok ? "bg-pri-soft text-pri-text" : "bg-rose-soft text-rose"}`}
                    >
                      {i.ok ? <Check className="h-3 w-3" strokeWidth={3} aria-label="Cumple" /> : <X className="h-3 w-3" strokeWidth={3} aria-label="Falta" />}
                    </span>
                    {i.etiqueta}
                  </li>
                ))}
              </ul>
            </section>

            <p className="mt-4 whitespace-pre-line text-[15px] leading-[1.55] text-ink-2">{elegido.descripcion}</p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {elegido.especialidades.map((e) => (
                <Chip key={e.id} tono={e.tipo}>
                  {e.nombre}
                </Chip>
              ))}
            </div>

            {elegido.redes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {elegido.redes.map((r) => (
                  <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-1 text-xs text-pri-text hover:underline">
                    <Link2 className="h-3 w-3" /> {NOMBRE_RED[r.tipo]}
                  </a>
                ))}
              </div>
            )}

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[.08em] text-ink-3">Portafolio</p>
              {elegido.portafolio.length === 0 ? (
                <p className="text-sm text-ink-3">Sin proyectos en el portafolio.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {elegido.portafolio.map((item, i) => (
                    <div key={i} className="rounded-md border border-line-2 p-3">
                      <p className="text-sm font-semibold text-ink">
                        {item.nombreProyecto}
                        {item.anio && <span className="font-normal text-ink-3"> · {item.anio}</span>}
                      </p>
                      {item.entidad && <p className="text-xs text-ink-3">{item.entidad}</p>}
                      {item.descripcion && <p className="mt-1 text-sm text-ink-2">{item.descripcion}</p>}
                      {item.resultado && <p className="mt-1 text-xs font-medium text-ink">Resultado: {item.resultado}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-[4px] border border-line-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-pri-soft text-pri-text">
                  <FileText className="h-4 w-4" />
                </span>
                <p className="text-sm font-medium text-ink">{elegido.tieneHojaDeVida ? "Hoja de vida (PDF)" : "Sin hoja de vida cargada"}</p>
              </div>
              {elegido.tieneHojaDeVida && (
                <Button variant="ghost" size="sm" onClick={() => verHojaDeVida(elegido)}>
                  Ver
                </Button>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5 border-t border-line-2 pt-5">
              <Button variant="primary" onClick={() => aprobar(elegido)} disabled={ocupado !== null}>
                <Check className="h-4 w-4" /> {ocupado === elegido.id ? "Aprobando…" : "Aprobar y publicar"}
              </Button>
              <Button
                variant="danger"
                disabled={ocupado !== null}
                onClick={() => {
                  setErrorModal(null);
                  setRechazando(elegido);
                }}
              >
                <X className="h-4 w-4" /> Rechazar y pedir cambios
              </Button>
            </div>
          </article>
        </div>
      )}

      {rechazando && (
        <ModalMotivo
          titulo="Rechazar perfil"
          explicacion={
            <>
              Explica a <span className="font-semibold text-ink">{rechazando.nombreProfesional}</span> qué debe
              corregir. Podrá editar su perfil y reenviarlo.
            </>
          }
          etiquetaConfirmar="Confirmar rechazo"
          error={errorModal}
          ocupado={ocupado === rechazando.id}
          onConfirmar={rechazar}
          onCerrar={() => setRechazando(null)}
        />
      )}
    </div>
  );
}
