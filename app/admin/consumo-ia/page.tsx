import { listarConsumos } from "@/lib/admin/consumo";
import { listarCuentasYTablero } from "@/lib/admin/suscripciones";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, KpiGrid } from "@/components/viz/KpiCard";
import { TablaConsumos } from "@/components/admin/TablaConsumos";
import { AlertTriangle, Coins, Sparkles, Wand2 } from "lucide-react";

export const metadata = { title: "Consumo de IA" };

// RF-108, RF-42, RF-52 · Consumo de IA del mes y los últimos consumos
// registrados. Solo lectura: lo que se cobra lo decide la base (RN-17).
export default async function ConsumoIAPage() {
  const [consumos, { tablero: t }] = await Promise.all([listarConsumos(), listarCuentasYTablero()]);
  const mes = new Intl.DateTimeFormat("es-CO", { month: "long", timeZone: "America/Bogota" }).format(new Date());
  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Consumo de IA" descripcion={`Uso del mes de ${mes} y los últimos ${consumos.length} consumos registrados.`} />
      <KpiGrid>
        <KpiCard etiqueta="Generaciones" valor={t.generacionesExitosas.toLocaleString("es-CO")} nota="Documentos generados este mes" icono={Sparkles} tono="violet" />
        <KpiCard etiqueta="Ajustes" valor={t.ajustes.toLocaleString("es-CO")} nota="Pedidos sobre documentos" icono={Wand2} tono="sky" />
        <KpiCard etiqueta="Fallidas" valor={t.generacionesFallidas.toLocaleString("es-CO")} nota="No consumen créditos (RN-17)" icono={AlertTriangle} tono="rose" />
        <KpiCard
          etiqueta="Costo estimado"
          valor={`$${t.costoUsd.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sufijo=" USD"
          nota={`${t.creditosDescontados.toLocaleString("es-CO")} créditos descontados`}
          icono={Coins}
          tono="amber"
        />
      </KpiGrid>
      <TablaConsumos consumos={consumos} />
    </div>
  );
}
