import { VistaSuscripcion } from "@/components/suscripcion/VistaSuscripcion";
import { listarPagosPropios } from "@/lib/suscripcion-servidor";

export const metadata = { title: "Mi suscripción" };

// CU-28, CU-30 · RF-41, RF-82. El layout ya exigió rol empresa y entrega los
// planes activos; aquí, el historial de pagos propio (RLS, docs/05 §9.28).
// RF-120: «Mejorar plan» llega con ?plan=<id> y ese plan queda señalado.
export default async function SuscripcionEmpresaPage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const { plan } = await searchParams;
  return <VistaSuscripcion rol="empresa" pagos={await listarPagosPropios()} planSenalado={typeof plan === "string" ? plan : null} />;
}
