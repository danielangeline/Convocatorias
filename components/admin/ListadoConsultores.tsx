"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Ban, RotateCcw, UserRound } from "lucide-react";
import type { ConsultorAdmin } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { ESTADO_PERFIL_LABEL, ESTADO_PERFIL_ESTILO } from "@/lib/utils";
import { fechaColombia } from "@/lib/fechas";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RatingStars } from "@/components/RatingStars";
import { EmptyState } from "@/components/ui/EmptyState";
import { Aviso } from "@/components/identidad/Campo";
import { ModalMotivo } from "./ModalMotivo";

/**
 * CU-27 · Consultores registrados (RF-35). Suspender pide motivo y cancela en
 * la base sus encargos en curso y pendientes (RN-29); reactivar no los revive.
 */
export function ListadoConsultores({ consultores }: { consultores: ConsultorAdmin[] }) {
  const router = useRouter();
  const [suspendiendo, setSuspendiendo] = useState<ConsultorAdmin | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);

  const suspender = async (motivo: string) => {
    if (!suspendiendo) return;
    setOcupado(suspendiendo.id);
    setErrorModal(null);
    const r = await peticionAdmin(`/api/admin/consultores/${suspendiendo.id}/suspender`, "POST", { motivo });
    setOcupado(null);
    if (!r.ok) {
      setErrorModal(r.error);
      return;
    }
    setAviso({ tipo: "exito", texto: `${suspendiendo.nombreProfesional}: ${r.aviso}` });
    setSuspendiendo(null);
    router.refresh();
  };

  const reactivar = async (c: ConsultorAdmin) => {
    setOcupado(c.id);
    setAviso(null);
    const r = await peticionAdmin(`/api/admin/consultores/${c.id}/reactivar`, "POST", {});
    setOcupado(null);
    setAviso(r.ok ? { tipo: "exito", texto: `${c.nombreProfesional}: ${r.aviso}` } : { tipo: "error", texto: r.error });
    router.refresh();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Consultores</h1>
        <p className="text-sm text-ink-soft">Todos los perfiles de consultor registrados en la plataforma.</p>
      </div>

      {aviso && (
        <div className="mb-4">
          <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>
        </div>
      )}

      {consultores.length === 0 ? (
        <EmptyState icon={Users} titulo="No hay consultores" descripcion="Aún no hay perfiles de consultor registrados." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3">Consultor</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Rating</th>
                <th className="px-5 py-3">Encargos</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {consultores.map((c) => (
                <tr key={c.id} className="align-top hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {c.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage
                        <img src={c.fotoUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-line" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-ink-faint ring-1 ring-line">
                          <UserRound className="h-4 w-4" />
                        </span>
                      )}
                      {c.estadoPerfil === "en_revision" ? (
                        <Link href="/admin/consultores/revision" className="font-medium text-ink hover:text-primary-800">
                          {c.nombreProfesional || "Sin nombre"}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">{c.nombreProfesional || "Sin nombre"}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge className={ESTADO_PERFIL_ESTILO[c.estadoPerfil]}>{ESTADO_PERFIL_LABEL[c.estadoPerfil]}</Badge>
                    {c.estadoPerfil === "suspendido" && c.motivoSuspension && (
                      <p className="mt-1 max-w-xs text-xs text-ink-faint">
                        {c.suspendidoAt && `Desde el ${fechaColombia(c.suspendidoAt)}. `}
                        {c.motivoSuspension}
                      </p>
                    )}
                    {c.estadoPerfil === "rechazado" && c.motivoRechazo && (
                      <p className="mt-1 max-w-xs text-xs text-ink-faint">{c.motivoRechazo}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <RatingStars valor={c.ratingPromedio} />
                  </td>
                  <td className="px-5 py-3 font-tabular text-ink-soft">
                    {c.totalEncargosCompletados} completados
                    {c.encargosActivos > 0 && <span className="block text-xs">{c.encargosActivos} activos</span>}
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{c.esEquipoInterno ? "Equipo interno" : "Externo"}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      {c.estadoPerfil === "aprobado" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={ocupado !== null}
                          onClick={() => {
                            setErrorModal(null);
                            setSuspendiendo(c);
                          }}
                          className="text-danger hover:bg-danger-bg"
                        >
                          <Ban className="h-3.5 w-3.5" /> Suspender
                        </Button>
                      )}
                      {c.estadoPerfil === "suspendido" && (
                        <Button variant="ghost" size="sm" disabled={ocupado !== null} onClick={() => reactivar(c)}>
                          <RotateCcw className="h-3.5 w-3.5" /> {ocupado === c.id ? "Reactivando…" : "Reactivar"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {suspendiendo && (
        <ModalMotivo
          titulo="Suspender consultor"
          explicacion={
            <>
              <span className="font-semibold text-ink">{suspendiendo.nombreProfesional}</span> saldrá del directorio
              {suspendiendo.encargosActivos > 0 ? (
                <>
                  {" "}y se cancelarán de inmediato sus{" "}
                  <span className="font-semibold text-danger">
                    {suspendiendo.encargosActivos} {suspendiendo.encargosActivos === 1 ? "encargo activo" : "encargos activos"}
                  </span>{" "}
                  (en curso y pendientes). Reactivarlo después no los reabre.
                </>
              ) : (
                ". No tiene encargos activos."
              )}{" "}
              Su historial y sus calificaciones se conservan.
            </>
          }
          etiquetaConfirmar="Suspender"
          error={errorModal}
          ocupado={ocupado === suspendiendo.id}
          onConfirmar={suspender}
          onCerrar={() => setSuspendiendo(null)}
        />
      )}
    </div>
  );
}
