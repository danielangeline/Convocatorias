"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Check, X, FileText, Globe, Link2, UserRound, History } from "lucide-react";
import type { ConsultorAdmin } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Perfiles en revisión</h1>
        <p className="text-sm text-ink-soft">
          Aprueba o rechaza los perfiles que los consultores enviaron. El que más lleva esperando va primero.
        </p>
      </div>

      {aviso && (
        <div className="mb-4">
          <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>
        </div>
      )}

      {consultores.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          titulo="No hay perfiles pendientes"
          descripcion="Cuando un consultor envíe su perfil a revisión aparecerá aquí."
        />
      ) : (
        <div className="space-y-6">
          {consultores.map((c) => (
            <article key={c.id} className="rounded-2xl border border-line bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {c.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage, cambia en cada carga
                    <img src={c.fotoUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-1 ring-line" />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-ink-faint ring-1 ring-line">
                      <UserRound className="h-7 w-7" />
                    </span>
                  )}
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">{c.nombreProfesional}</h2>
                    {c.sitioWeb && (
                      <a
                        href={c.sitioWeb}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-primary-700 hover:underline"
                      >
                        <Globe className="h-3 w-3" /> {c.sitioWeb}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => aprobar(c)} disabled={ocupado !== null}>
                    <Check className="h-3.5 w-3.5" /> {ocupado === c.id ? "Aprobando…" : "Aprobar"}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={ocupado !== null}
                    onClick={() => {
                      setErrorModal(null);
                      setRechazando(c);
                    }}
                  >
                    <X className="h-3.5 w-3.5" /> Rechazar
                  </Button>
                </div>
              </div>

              {c.motivoRechazo && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <History className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    <span className="font-semibold">Reenvío.</span> Motivo del rechazo anterior: {c.motivoRechazo}
                  </p>
                </div>
              )}

              <p className="mt-4 whitespace-pre-line text-sm text-ink-soft">{c.descripcion}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.especialidades.map((e) => (
                  <Chip key={e.id} tono={e.tipo}>
                    {e.nombre}
                  </Chip>
                ))}
              </div>

              {c.redes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {c.redes.map((r) => (
                    <a
                      key={r.url}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-primary-700 hover:underline"
                    >
                      <Link2 className="h-3 w-3" /> {NOMBRE_RED[r.tipo]}
                    </a>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Portafolio</p>
                {c.portafolio.length === 0 ? (
                  <p className="text-sm text-ink-faint">Sin proyectos en el portafolio.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {c.portafolio.map((item, i) => (
                      <div key={i} className="rounded-xl border border-line-soft p-3">
                        <p className="text-sm font-semibold text-ink">
                          {item.nombreProyecto}
                          {item.anio && <span className="font-normal text-ink-faint"> · {item.anio}</span>}
                        </p>
                        {item.entidad && <p className="text-xs text-ink-faint">{item.entidad}</p>}
                        {item.descripcion && <p className="mt-1 text-sm text-ink-soft">{item.descripcion}</p>}
                        {item.resultado && <p className="mt-1 text-xs font-medium text-ink">Resultado: {item.resultado}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-line-soft px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                    <FileText className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-medium text-ink">
                    {c.tieneHojaDeVida ? "Hoja de vida (PDF)" : "Sin hoja de vida cargada"}
                  </p>
                </div>
                {c.tieneHojaDeVida && (
                  <Button variant="ghost" size="sm" onClick={() => verHojaDeVida(c)}>
                    Ver
                  </Button>
                )}
              </div>
            </article>
          ))}
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
