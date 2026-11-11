import { FormularioDefinirContrasena } from "@/components/identidad/FormularioDefinirContrasena";

export const metadata = { title: "Definir contraseña · FundRadar", robots: { index: false } };

// CU-42 (activar la cuenta de administrador invitada) y RF-03 (recuperación).
export default function DefinirContrasenaPage() {
  return <FormularioDefinirContrasena />;
}
