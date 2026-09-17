"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailPlus, Send, ShieldCheck, ShieldOff, UserCog, UserX, X } from "lucide-react";
import type { EstadoInvitacionAdmin, InvitacionAdminListado, ListadoAdministradores } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Aviso, Campo } from "@/components/identidad/Campo";

// Hora de Colombia fija: el servidor y el navegador deben pintar lo mismo.
const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(iso));

const ESTADO_INVITACION: Record<EstadoInvitacionAdmin, { etiqueta: string; estilo: string }> = {
  pendiente: { etiqueta: "Pendiente", estilo: "bg-amber-50 text-amber-700 ring-amber-200" },
  aceptada: { etiqueta: "Aceptada", estilo: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  cancelada: { etiqueta: "Cancelada", estilo: "bg-slate-100 text-slate-600 ring-slate-200" },
  vencida: { etiqueta: "Vencida", estilo: "bg-danger-bg text-danger ring-red-200" },
};

type Mensaje = { tipo: "error" | "exito"; texto: string } | null;

async function llamar(url: string, cuerpo?: unknown): Promise<{ error?: string; aviso?: string | null }> {
  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo ?? {}),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) return { error: datos.error ?? "No pudimos completar la acción. Intenta de nuevo." };
    return { aviso: datos.aviso };
  } catch {
    return { error: "No hay conexión con el servidor. Intenta de nuevo." };
  }
}

/**
 * CU-41 · Gestión de administradores del Propietario. No decide nada: cada
 * acción la valida el servidor (RF-86) y la pantalla se vuelve a leer después.
 */
export function GestionAdministradores({
  listado,
  propietarioId,
}: {
  listado: ListadoAdministradores;
  propietarioId: string;
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [formulario, setFormulario] = useState({ nombre: "", correo: "" });

  async function ejecutar(clave: string, url: string, exito: string, cuerpo?: unknown) {
    setOcupado(clave);
    setMensaje(null);
    const { error, aviso } = await llamar(url, cuerpo);
    setOcupado(null);
    setConfirmando(null);
    setMensaje(error ? { tipo: "error", texto: error } : { tipo: "exito", texto: aviso ?? exito });
    router.refresh();
    return !error;
  }

  async function invitar(evento: React.FormEvent) {
    evento.preventDefault();
    const correo = formulario.correo.trim();
    const ok = await ejecutar(
      "invitar",
      "/api/admin/administradores/invitar",
      `Invitación enviada a ${correo}. Vence en 72 horas.`,
      { nombre: formulario.nombre, correo }
    );
    if (ok) setFormulario({ nombre: "", correo: "" });
  }

  const activos = listado.administradores.filter((a) => !a.revocadoAt);
  const revocados = listado.administradores.filter((a) => a.revocadoAt);
  const abiertas = listado.invitaciones.filter((i) => i.estado === "pendiente" || (i.estado === "vencida" && i.tieneCuenta));
  const historial = listado.invitaciones.filter((i) => !abiertas.includes(i));

  // Botón de acción irreversible con confirmación en línea.
  function confirmable({
    clave,
    etiqueta,
    pregunta,
    alConfirmar,
    icono: Icono,
  }: {
    clave: string;
    etiqueta: string;
    pregunta: string;
    alConfirmar: () => void;
    icono: React.ElementType;
  }) {
    if (confirmando !== clave) {
      return (
        <Button variant="ghost" size="sm" className="text-danger hover:bg-red-50" disabled={ocupado !== null} onClick={() => setConfirmando(clave)}>
          <Icono className="h-3.5 w-3.5" /> {etiqueta}
        </Button>
      );
    }
    return (
      <span className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs text-ink-soft">{pregunta}</span>
        <Button variant="danger" size="sm" disabled={ocupado !== null} onClick={alConfirmar}>
          {ocupado === clave ? "Procesando…" : "Confirmar"}
        </Button>
        <Button variant="ghost" size="sm" disabled={ocupado !== null} onClick={() => setConfirmando(null)}>
          <X className="h-3.5 w-3.5" /> No
        </Button>
      </span>
    );
  }

  function accionesInvitacion(i: InvitacionAdminListado) {
    const cancelar = (etiqueta: string, pregunta: string, exito: string) =>
      confirmable({
        clave: `cancelar-${i.id}`,
        etiqueta,
        pregunta,
        icono: UserX,
        alConfirmar: () => ejecutar(`cancelar-${i.id}`, `/api/admin/invitaciones/${i.id}/cancelar`, exito),
      });
    if (i.estado === "pendiente") {
      return (
        <>
          {confirmando !== `cancelar-${i.id}` && (
            <Button
              variant="secondary"
              size="sm"
              disabled={ocupado !== null}
              onClick={() => ejecutar(`reenviar-${i.id}`, `/api/admin/invitaciones/${i.id}/reenviar`, `Enlace reenviado a ${i.correo}.`)}
            >
              <Send className="h-3.5 w-3.5" /> {ocupado === `reenviar-${i.id}` ? "Reenviando…" : "Reenviar"}
            </Button>
          )}
          {cancelar("Cancelar", "¿Cancelar y borrar la cuenta sin activar?", `Invitación de ${i.correo} cancelada.`)}
        </>
      );
    }
    if (i.tieneCuenta) {
      return cancelar(
        i.estado === "vencida" ? "Borrar cuenta sin activar" : "Reintentar borrado",
        "¿Borrar la cuenta que nunca se activó?",
        `Cuenta sin activar de ${i.correo} borrada.`
      );
    }
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary-700">
          <UserCog className="h-3.5 w-3.5" /> Propietario
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">Administradores</h1>
        <p className="text-sm text-ink-soft">
          Solo tú puedes dar o retirar acceso al panel. Cada invitación, cancelación y revocación queda registrada en los eventos de seguridad.
        </p>
      </div>

      {mensaje && (
        <div className="mb-6">
          <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>
        </div>
      )}

      {/* Invitar (CU-41 pasos 2-3) */}
      <form onSubmit={invitar} className="mb-8 rounded-2xl border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          <MailPlus className="h-4 w-4 text-primary-700" /> Invitar administrador
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Usa un correo que no tenga cuenta en la plataforma: el acceso administrativo va en una cuenta dedicada. La invitación vence en 72 horas y la persona debe activar la verificación en dos pasos.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Campo
            etiqueta="Nombre"
            name="nombre"
            required
            maxLength={200}
            value={formulario.nombre}
            onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))}
          />
          <Campo
            etiqueta="Correo"
            name="correo"
            type="email"
            required
            maxLength={320}
            autoComplete="off"
            value={formulario.correo}
            onChange={(e) => setFormulario((f) => ({ ...f, correo: e.target.value }))}
          />
          <Button type="submit" disabled={ocupado !== null}>
            <Send className="h-4 w-4" /> {ocupado === "invitar" ? "Enviando…" : "Enviar invitación"}
          </Button>
        </div>
      </form>

      {/* Invitaciones abiertas */}
      <section className="mb-8 rounded-2xl border border-line bg-white p-6">
        <h2 className="font-display text-base font-semibold text-ink">Invitaciones por resolver</h2>
        {abiertas.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">No hay invitaciones pendientes.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {abiertas.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    {i.nombre ?? i.correo}
                    <Badge className={ESTADO_INVITACION[i.estado].estilo}>{ESTADO_INVITACION[i.estado].etiqueta}</Badge>
                  </p>
                  <p className="text-xs text-ink-faint">
                    {i.correo} · invitada {fechaHora(i.creadaAt)}
                    {i.invitadoPorNombre ? ` por ${i.invitadoPorNombre}` : ""} ·{" "}
                    {i.estado === "vencida" ? "venció" : "vence"} {fechaHora(i.expiraAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">{accionesInvitacion(i)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Administradores con acceso (CU-41 pasos 4-5) */}
      <section className="mb-8 rounded-2xl border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 text-emerald-600" /> Con acceso
        </h2>
        <ul className="mt-4 divide-y divide-line">
          {activos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  {a.nombre ?? a.correo}
                  {a.esPropietario && <Badge className="bg-primary-50 text-primary-700 ring-primary-100">Propietario</Badge>}
                  {!a.mfaHabilitado && <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Sin MFA registrado</Badge>}
                </p>
                <p className="text-xs text-ink-faint">
                  {a.correo} · desde {fechaHora(a.creadoAt)}
                  {a.invitadoPorNombre ? ` · invitado por ${a.invitadoPorNombre}` : ""}
                </p>
              </div>
              {!a.esPropietario &&
                a.id !== propietarioId &&
                confirmable({
                  clave: `revocar-${a.id}`,
                  etiqueta: "Revocar acceso",
                  pregunta: "Pierde el acceso ahora y se cierran sus sesiones.",
                  icono: ShieldOff,
                  alConfirmar: () =>
                    ejecutar(`revocar-${a.id}`, `/api/admin/administradores/${a.id}/revocar`, `Acceso de ${a.correo} revocado.`),
                })}
            </li>
          ))}
        </ul>
      </section>

      {(revocados.length > 0 || historial.length > 0) && (
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="font-display text-base font-semibold text-ink">Historial</h2>
          <ul className="mt-4 divide-y divide-line">
            {revocados.map((a) => (
              <li key={a.id} className="py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  {a.nombre ?? a.correo}
                  <Badge className="bg-danger-bg text-danger ring-red-200">Revocado</Badge>
                </p>
                <p className="text-xs text-ink-faint">
                  {a.correo} · revocado {a.revocadoAt ? fechaHora(a.revocadoAt) : ""}
                  {a.revocadoPorNombre ? ` por ${a.revocadoPorNombre}` : ""}
                </p>
              </li>
            ))}
            {historial.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    {i.nombre ?? i.correo}
                    <Badge className={ESTADO_INVITACION[i.estado].estilo}>Invitación {ESTADO_INVITACION[i.estado].etiqueta.toLowerCase()}</Badge>
                  </p>
                  <p className="text-xs text-ink-faint">
                    {i.correo} · invitada {fechaHora(i.creadaAt)}
                    {i.invitadoPorNombre ? ` por ${i.invitadoPorNombre}` : ""}
                    {i.resueltaAt ? ` · resuelta ${fechaHora(i.resueltaAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">{accionesInvitacion(i)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
