import { GuardaConsultor } from "@/components/GuardaConsultor";
import { VistaSuscripcion } from "@/components/suscripcion/VistaSuscripcion";
import { listarPagosPropios } from "@/lib/suscripcion-servidor";

export const metadata = { title: "Mi suscripción" };

// CU-28, CU-30 · RF-41. El layout ya exigió rol consultor y entrega los planes
// activos; aquí, el historial de pagos propio (RLS, docs/05 §9.28).
export default async function SuscripcionConsultorPage() {
  const pagos = await listarPagosPropios();
  return (
    <GuardaConsultor>
      <VistaSuscripcion rol="consultor" pagos={pagos} />
    </GuardaConsultor>
  );
}
