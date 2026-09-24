import Link from "next/link";
import { PerfilConsultorVista } from "@/components/consultores/PerfilConsultorVista";
import { UUID } from "@/lib/api-empresa";
import { obtenerPerfilPublico } from "@/lib/consultores-directorio";

export const metadata = { title: "Perfil del consultor" };

// CU-21 · RF-27, RF-80. El layout del portal ya exigió rol empresa; la RLS
// decide qué perfil existe y el contacto solo llega con un encargo en curso.
export default async function PerfilConsultorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const consultor = UUID.test(id) ? await obtenerPerfilPublico(id) : null;

  if (!consultor) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">No encontramos este consultor.</p>
        <Link href="/consultores" className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline">
          Volver al directorio
        </Link>
      </div>
    );
  }
  return <PerfilConsultorVista consultor={consultor} />;
}
