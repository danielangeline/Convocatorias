import type { RolUsuario } from "./types";

/** Pantalla de inicio de cada rol después de entrar (CU-14). */
export function rutaInicioDeRol(rol: RolUsuario): string {
  switch (rol) {
    case "empresa":
      return "/convocatorias";
    case "consultor":
      return "/consultor/perfil";
    case "administrador":
      return "/admin";
  }
}
