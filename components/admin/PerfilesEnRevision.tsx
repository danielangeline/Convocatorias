"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import type { ConsultorAdmin } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { Card, CardHeader } from "@/components/ui/Card";
import { TONO_CLASE } from "@/components/viz/tonos";
import { ModalMotivo } from "./ModalMotivo";

function iniciales(texto: string): string {
  const p = texto.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p[1]?.[0] ?? "")).toUpperCase();
}

/**
 * CU-25, RF-34 · Perfiles en revisión en el dashboard, con aprobar y rechazar
 * en línea. Los mismos endpoints que la bandeja: la base valida y bloquea la
 * fila (CU-25 3a), y el rechazo exige motivo (RN-13).
 */
export function PerfilesEnRevision({ perfiles }: { perfiles: ConsultorAdmin[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<ConsultorAdmin | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const aprobar = async (c: ConsultorAdmin) => {
    setOcupado(c.id);
    setAviso(null);
    const r = await peticionAdmin(`/api/admin/consultores/${c.id}/aprobar`, "POST", {});
    setOcupado(null);
    if (!r.ok) setAviso(r.error);
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
    setRechazando(null);
    router.refresh();
  };

  return (
    <Card className="flex flex-col gap-1">
      <CardHeader
        className="mb-2"
        titulo="Perfiles en revisión"
        accion={<span className="font-tabular text-xs text-ink-3">{perfiles.length}</span>}
      />
      {aviso && (
        <p role="alert" className="mb-2 rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose-ink">
          {aviso}
        </p>
      )}
      {perfiles.length === 0 ? (
        <p className="text-[13px] text-ink-3">No hay perfiles esperando revisión.</p>
      ) : (
        perfiles.slice(0, 5).map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b border-line-2 py-2.5 last:border-b-0">
            <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-full text-xs font-extrabold ${TONO_CLASE.sky}`}>
              {iniciales(c.nombreProfesional || "?")}
            </span>
            <Link href="/admin/consultores/revision" className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-bold">{c.nombreProfesional || "(sin nombre)"}</div>
              <div className="truncate text-xs text-ink-3">
                {c.especialidades.slice(0, 2).map((e) => e.nombre).join(" · ") || "Sin especialidades"}
              </div>
            </Link>
            <button
              type="button"
              onClick={() => aprobar(c)}
              disabled={ocupado !== null}
              title="Aprobar"
              aria-label={`Aprobar a ${c.nombreProfesional}`}
              className="grid h-10 w-10 flex-none cursor-pointer place-items-center rounded-[10px] bg-pri-soft text-pri-text hover:brightness-95 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorModal(null);
                setRechazando(c);
              }}
              disabled={ocupado !== null}
              title="Rechazar"
              aria-label={`Rechazar a ${c.nombreProfesional}`}
              className="grid h-10 w-10 flex-none cursor-pointer place-items-center rounded-[10px] border border-line text-ink-3 hover:text-rose-ink disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))
      )}
      {perfiles.length > 5 && (
        <Link href="/admin/consultores/revision" className="mt-2 text-[12.5px] font-bold text-pri-text">
          Ver los {perfiles.length}
        </Link>
      )}
      {rechazando && (
        <ModalMotivo
          titulo="Rechazar perfil"
          explicacion={
            <>
              Explica a <span className="font-semibold text-ink">{rechazando.nombreProfesional}</span> qué debe corregir.
              Podrá editar su perfil y reenviarlo.
            </>
          }
          etiquetaConfirmar="Confirmar rechazo"
          error={errorModal}
          ocupado={ocupado === rechazando.id}
          onConfirmar={rechazar}
          onCerrar={() => setRechazando(null)}
        />
      )}
    </Card>
  );
}
