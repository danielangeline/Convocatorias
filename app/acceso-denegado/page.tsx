import { AccesoDenegado } from "@/components/AccesoDenegado";

export const metadata = { title: "Acceso denegado · Gestión de Convocatorias", robots: { index: false } };

// Destino interno del 403 que devuelve proxy.ts. Una visita directa a esta
// ruta no llega aquí: no está en la matriz y responde 404.
export default function AccesoDenegadoPage() {
  return <AccesoDenegado />;
}
