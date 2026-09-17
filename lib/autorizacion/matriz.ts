import "server-only";
import type { RolUsuario } from "@/lib/types";

/**
 * Matriz rol × ruta (RNF-30). Es la única declaración de quién entra a qué, y
 * la aplica `proxy.ts` a cada petición: páginas, peticiones RSC, Server
 * Actions y `/api`. Una ruta que no figura aquí responde 404 (cerrado por
 * defecto): una pantalla o endpoint nuevo no queda abierto por olvido.
 *
 * Este módulo nombra las rutas del panel: nunca debe llegar al navegador
 * (RNF-35), de ahí `server-only`.
 */
export type Regla =
  | { tipo: "publica" }
  | {
      tipo: "roles";
      roles: RolUsuario[];
      // Panel administrativo: a quien no es administrador se le responde 404,
      // no 403, para no revelar que existe (RF-85, RNF-35).
      oculta?: boolean;
      // Exige segundo factor verificado en la sesión (RNF-28).
      exigeMfa?: boolean;
    };

const EMPRESA: Regla = { tipo: "roles", roles: ["empresa"] };
const CONSULTOR: Regla = { tipo: "roles", roles: ["consultor"] };
const PANEL: Regla = { tipo: "roles", roles: ["administrador"], oculta: true, exigeMfa: true };

// Rutas exactas.
const EXACTAS: Record<string, Regla> = {
  "/": { tipo: "publica" },
};

// Prefijos: aplican a la ruta y a todo lo que cuelga de ella.
const PREFIJOS: [string, Regla][] = [
  // Identidad (CU-14, CU-42)
  ["/login", { tipo: "publica" }],
  ["/registro", { tipo: "publica" }],
  ["/auth/confirmar", { tipo: "publica" }],
  ["/auth/definir-contrasena", { tipo: "publica" }],
  // Verificación en dos pasos: solo administradores, todavía sin aal2 (CU-38)
  ["/mfa", { tipo: "roles", roles: ["administrador"], oculta: true }],
  // Panel administrativo (RF-85)
  ["/admin", PANEL],
  ["/api/admin", PANEL],
  // Portal Empresa (docs/04 §8.2)
  ["/convocatorias", EMPRESA],
  ["/proyectos", EMPRESA],
  ["/documentos", EMPRESA],
  ["/postulaciones", EMPRESA],
  ["/consultores", EMPRESA],
  ["/encargos", EMPRESA],
  ["/suscripcion", EMPRESA],
  // Portal Consultor
  ["/consultor", CONSULTOR],
];

// Rutas internas del servidor de desarrollo de Next (overlay de errores).
if (process.env.NODE_ENV === "development") {
  PREFIJOS.push(["/__nextjs", { tipo: "publica" }]);
}

export function reglaDeRuta(ruta: string): Regla | null {
  if (EXACTAS[ruta]) return EXACTAS[ruta];
  for (const [prefijo, regla] of PREFIJOS) {
    if (ruta === prefijo || ruta.startsWith(prefijo + "/")) return regla;
  }
  return null;
}
