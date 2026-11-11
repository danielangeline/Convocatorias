import { listarConsumos } from "@/lib/admin/consumo";
import { listarCuentasYTablero } from "@/lib/admin/suscripciones";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCelda, KpiFranja } from "@/components/viz/KpiCard";
import { TablaConsumos } from "@/components/admin/TablaConsumos";

export const metadata = { title: "Consumo de IA" };

// RF-108, RF-42, RF-52 · Consumo de IA del mes y los últimos consumos
// registrados. Solo lectura: lo que se cobra lo decide la base (RN-17).
export default async function ConsumoIAPage() {
  const [consumos, { tablero: t }] = await Promise.all([listarConsumos(), listarCuentasYTablero()]);
  const mes = new Intl.DateTimeFormat("es-CO", { month: "long", timeZone: "America/Bogota" }).format(new Date());
  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Consumo de IA" descripcion={`Uso del mes de ${mes} y los últimos ${consumos.length} consumos registrados.`} />
      <KpiFranja>
        <KpiCelda etiqueta="Generaciones" valor={t.generacionesExitosas.toLocaleString("es-CO")} nota="Documentos generados este mes" />
        <KpiCelda etiqueta="Ajustes" valor={t.ajustes.toLocaleString("es-CO")} nota="Pedidos sobre documentos" />
        <KpiCelda etiqueta="Fallidas" valor={t.generacionesFallidas.toLocaleString("es-CO")} nota="No consumen créditos (RN-17)" />
        <KpiCelda
          etiqueta="Costo estimado"
          valor={`$${t.costoUsd.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sufijo=" USD"
          nota={`${t.creditosDescontados.toLocaleString("es-CO")} créditos descontados`}
        />
      </KpiFranja>
      <TablaConsumos consumos={consumos} />
    </div>
  );
}
