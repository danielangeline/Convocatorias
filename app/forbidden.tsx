import { AccesoDenegado } from "@/components/AccesoDenegado";

// Se muestra cuando un layout llama a forbidden() (segunda barrera de RNF-30).
export default function Forbidden() {
  return <AccesoDenegado />;
}
