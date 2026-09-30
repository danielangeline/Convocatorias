import { GuardaConsultor } from "@/components/GuardaConsultor";
import { EncargosConsultor } from "@/components/encargos/EncargosConsultor";
import { listarEncargosConsultor } from "@/lib/encargos-servidor";

// CU-18 · Bandeja del consultor, leída con su sesión: la RLS solo deja ver sus
// encargos y, mientras están vivos, su contexto (RN-25).
export default async function EncargosConsultorPage() {
  const encargos = await listarEncargosConsultor();
  return (
    <GuardaConsultor>
      <EncargosConsultor encargos={encargos} />
    </GuardaConsultor>
  );
}
