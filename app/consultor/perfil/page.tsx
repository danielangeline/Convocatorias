import { AlertCircle } from "lucide-react";
import { exigirRol } from "@/lib/auth";
import { listarCategoriasActivas } from "@/lib/catalogo";
import { obtenerPerfilPropio } from "@/lib/consultor-perfil-servidor";
import { EditorPerfil } from "@/components/consultor/EditorPerfil";
import { EmptyState } from "@/components/ui/EmptyState";

// CU-16, CU-17 · El perfil real del consultor, leído con su sesión (RLS).
export default async function PerfilConsultorPage() {
  const { sesion } = await exigirRol(["consultor"], { ruta: "portal consultor" });
  const [perfil, categorias] = await Promise.all([obtenerPerfilPropio(sesion.usuarioId), listarCategoriasActivas()]);

  if (!perfil) {
    return (
      <EmptyState
        icon={AlertCircle}
        titulo="No encontramos tu perfil de consultor"
        descripcion="Recarga la página. Si el problema sigue, escríbele al equipo de la plataforma."
      />
    );
  }

  return <EditorPerfil perfilInicial={perfil} categorias={categorias} />;
}
