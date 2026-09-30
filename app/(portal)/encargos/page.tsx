import { EncargosEmpresa } from "@/components/encargos/EncargosEmpresa";
import { listarEncargosEmpresa } from "@/lib/encargos-servidor";

// CU-22..24 · Solicitudes y encargos de la empresa, leídos con su sesión (RN-30).
export default async function EncargosPage() {
  return <EncargosEmpresa encargos={await listarEncargosEmpresa()} />;
}
