import { FichaConvocatoria } from "@/components/catalogo/FichaConvocatoria";
import { listarCategoriasActivas, listarPaises, obtenerFicha } from "@/lib/catalogo";
import { textoPaises } from "@/lib/monedas";
import { listarGuardadas } from "@/lib/guardadas-servidor";
import { compatibilidadEmpresa } from "@/lib/compatibilidad-empresa";
import type { CriterioCompat } from "@/components/viz/CompatBreakdown";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RF-13, CU-08 · Ficha leída con la sesión de la empresa: si la RLS no deja
// verla, para ella no existe (RN-33).
export default async function DetalleConvocatoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [convocatoria, categorias, guardadas, paises, compat] = await Promise.all([
    UUID.test(id) ? obtenerFicha(id) : Promise.resolve(null),
    listarCategoriasActivas(),
    listarGuardadas(),
    listarPaises(),
    compatibilidadEmpresa(),
  ]);
  const paisesTexto = convocatoria ? textoPaises(convocatoria, new Map(paises.map((p) => [p.codigo, p.nombre]))) : undefined;
  // CU-10, RN-05: el cruce determinístico con el proyecto que mejor coincide, criterio por criterio.
  const cruce = compat.porConvocatoria.get(id);
  const compatibilidad = cruce
    ? {
        porcentaje: cruce.porcentaje,
        proyectoNombre: cruce.proyectoNombre,
        criterios: cruce.criterios.map(
          (c): CriterioCompat => ({
            nombre: c.etiqueta,
            estado: c.estado === "cumple" ? "coincide" : c.estado === "no_cumple" ? "no_coincide" : "parcial",
            resultado:
              c.estado === "cumple" ? "Coincide" : c.estado === "no_cumple" ? "No coincide" : c.estado === "sin_tasa" ? "Sin tasa de cambio" : "Sin dato",
          })
        ),
      }
    : null;
  return (
    <FichaConvocatoria
      convocatoria={convocatoria}
      categorias={categorias}
      guardada={guardadas.includes(id)}
      paisesTexto={paisesTexto}
      compatibilidad={compatibilidad}
    />
  );
}
