import { Bookmark } from "lucide-react";
import { listarCatalogo, listarCategoriasActivas } from "@/lib/catalogo";
import { listarGuardadas } from "@/lib/guardadas-servidor";
import { compatibilidadEmpresa } from "@/lib/compatibilidad-empresa";
import type { Convocatoria } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { ListaGuardadas } from "@/components/catalogo/ListaGuardadas";

export const metadata = { title: "Guardadas" };

// RF-103, CU-45 · Las convocatorias que la empresa guardó, en el orden en que
// las guardó. Una que ya cerró sigue aquí, atenuada y sin acciones (RN-02).
export default async function GuardadasPage() {
  const [ids, catalogo, categorias, compat] = await Promise.all([
    listarGuardadas(),
    listarCatalogo(true),
    listarCategoriasActivas(),
    compatibilidadEmpresa(),
  ]);
  const porId = new Map(catalogo.map((c) => [c.id, c]));
  const convocatorias = ids.map((id) => porId.get(id)).filter((c): c is Convocatoria => c !== undefined);
  const compatibilidad = Object.fromEntries([...compat.porConvocatoria.values()].map((c) => [c.convocatoria.id, c.porcentaje]));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Guardadas" descripcion="Las convocatorias que marcaste para revisar después." />
      {convocatorias.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          titulo="Aún no guardas convocatorias"
          descripcion="En el catálogo, toca el marcador de una tarjeta para tenerla a mano aquí."
          accion={<LinkButton href="/convocatorias">Explorar convocatorias</LinkButton>}
        />
      ) : (
        <ListaGuardadas convocatorias={convocatorias} categorias={categorias} compatibilidad={compatibilidad} />
      )}
    </div>
  );
}
