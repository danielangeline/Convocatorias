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

/** Las dos puertas de la entrada (RF-84). Ninguna lleva al panel administrativo. */
export type Puerta = "empresa" | "consultor";

/** Lee la puerta de `?puerta=`; cualquier otro valor cae en la de empresa. */
export function puertaDeParametro(valor: string | string[] | undefined): Puerta {
  return valor === "consultor" ? "consultor" : "empresa";
}

/**
 * Parámetro que el login agrega al inicio del portal cuando la puerta elegida
 * no coincidía con el rol de la cuenta (RF-84, CU-14 flujo 4a).
 */
export const AVISO_PUERTA = "aviso=puerta";
