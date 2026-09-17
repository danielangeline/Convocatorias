import { FormularioDefinirContrasena } from "@/components/identidad/FormularioDefinirContrasena";

export const metadata = { title: "Definir contraseña · Gestión de Convocatorias", robots: { index: false } };

// CU-42 (activar la cuenta de administrador invitada) y RF-03 (recuperación).
export default function DefinirContrasenaPage() {
  return <FormularioDefinirContrasena />;
}
