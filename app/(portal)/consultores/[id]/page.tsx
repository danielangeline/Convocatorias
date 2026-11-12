import Link from "next/link";
import { PerfilConsultorVista } from "@/components/consultores/PerfilConsultorVista";
import { UUID } from "@/lib/api-empresa";
import { obtenerPerfilPublico } from "@/lib/consultores-directorio";
import { PantallaBloqueada } from "@/components/plan/FuncionBloqueada";
import { planEfectivoSesion } from "@/lib/plan-servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata = { title: "Perfil del consultor" };

// CU-21 · RF-27, RF-80. El layout del portal ya exigió rol empresa; la RLS
// decide qué perfil existe y el contacto solo llega con un encargo en curso.
export default async function PerfilConsultorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // RN-41 (sesión 042): sin el plan Pro, solo el perfil de un consultor de sus encargos.
  const plan = await planEfectivoSesion();
  if (!plan?.funciones.consultores) {
    const supabase = await crearClienteServidor();
    const { data: encargo } = UUID.test(id)
      ? await supabase.from("encargos").select("id").eq("consultor_id", id).limit(1).maybeSingle()
      : { data: null };
    if (!encargo) return <PantallaBloqueada funcion="consultores" titulo="Perfil del consultor" />;
  }
  const consultor = UUID.test(id) ? await obtenerPerfilPublico(id) : null;

  if (!consultor) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-2">No encontramos este consultor.</p>
        <Link href="/consultores" className="mt-3 inline-block text-sm font-semibold text-pri-text hover:underline">
          Volver al directorio
        </Link>
      </div>
    );
  }
  return <PerfilConsultorVista consultor={consultor} />;
}
