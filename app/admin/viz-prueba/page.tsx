import { VizMuestra } from "@/components/viz/VizMuestra";

// Fase 1 del rediseño: pagina de prueba. No es "_viz" porque Next trata las
// carpetas con guion bajo como privadas (no enrutables). Se borra en la fase 6.
export default function Page() {
  return <VizMuestra />;
}
