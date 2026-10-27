import { KeyRound, LogOut } from "lucide-react";
import { obtenerSesion } from "@/lib/auth";
import { cerrarSesion } from "@/lib/acciones/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { AjustesApariencia } from "@/components/ajustes/AjustesApariencia";

export const metadata = { title: "Ajustes" };

// RF-107 · Ajustes de la empresa: los datos de la cuenta (de solo lectura,
// los fija el registro), el cambio de contraseña por el flujo de
// recuperación (CU-15) y las preferencias de este navegador.
export default async function AjustesPage() {
  const datos = await obtenerSesion();
  const s = datos?.sesion;

  const fila = (etiqueta: string, valor: string) => (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line-2 py-3 first:border-t-0 first:pt-0">
      <dt className="text-[13px] text-ink-3">{etiqueta}</dt>
      <dd className="m-0 text-[13.5px] font-semibold">{valor}</dd>
    </div>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader titulo="Ajustes" descripcion="Tu cuenta y cómo se ve la plataforma en este navegador." />

      <Card className="flex flex-col gap-4">
        <CardHeader titulo="Cuenta" subtitulo="Los datos con que te registraste." />
        <dl className="m-0">
          {fila("Empresa o entidad", s?.nombreEmpresa ?? "—")}
          {fila("Persona de contacto", s?.nombre ?? "—")}
          {fila("Correo", s?.correo ?? "—")}
        </dl>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardHeader titulo="Seguridad" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[13.5px] font-bold">Contraseña</div>
            <div className="text-xs text-ink-3">Te enviamos un enlace a tu correo para definir una nueva.</div>
          </div>
          <LinkButton href="/auth/recuperar" variant="secondary">
            <KeyRound className="h-4 w-4" /> Cambiar contraseña
          </LinkButton>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-2 pt-4">
          <div>
            <div className="text-[13.5px] font-bold">Sesión</div>
            <div className="text-xs text-ink-3">Cierra la sesión en este navegador.</div>
          </div>
          <form action={cerrarSesion}>
            <Button type="submit" variant="secondary">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </Button>
          </form>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardHeader titulo="Apariencia" />
        <AjustesApariencia />
      </Card>
    </div>
  );
}
