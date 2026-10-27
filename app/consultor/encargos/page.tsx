import { GuardaConsultor } from "@/components/GuardaConsultor";
import { EncargosConsultor } from "@/components/encargos/EncargosConsultor";
import { listarEncargosConsultor } from "@/lib/encargos-servidor";
import { exigirRol } from "@/lib/auth";

// CU-18 · Bandeja del consultor, leída con su sesión: la RLS solo deja ver sus
// encargos y, mientras están vivos, su contexto (RN-25).
export default async function EncargosConsultorPage() {
  const [encargos, datos] = await Promise.all([listarEncargosConsultor(), exigirRol(["consultor"], { ruta: "portal consultor" })]);
  const perfil = datos.consultor;
  return (
    <GuardaConsultor>
      <EncargosConsultor
        encargos={encargos}
        ratingPromedio={perfil?.ratingPromedio}
        completados={perfil?.totalEncargosCompletados}
        aprobado={perfil?.estadoPerfil === "aprobado"}
      />
    </GuardaConsultor>
  );
}
