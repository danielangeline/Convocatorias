import { SugerenciasProyecto } from "@/components/proyectos/SugerenciasProyecto";
import { sugerenciasDeProyecto } from "@/lib/sugerencias";

// CU-10, RF-15, RF-16 · Se calcula en el servidor con la sesión de la empresa
// (docs/05 §9.6): proyecto ajeno, no existe (RN-30); sin suscripción, no se calcula.
export default async function SugerenciasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await sugerenciasDeProyecto(id);
  return r.ok ? (
    <SugerenciasProyecto resultado={r.datos} error={null} />
  ) : (
    <SugerenciasProyecto resultado={null} error={{ status: r.status, texto: r.error }} />
  );
}
