import {
  BriefcaseBusiness,
  ClipboardCheck,
  CreditCard,
  Folder,
  House,
  Search,
  SlidersHorizontal,
  Sparkles,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { FuncionPlan } from "@/lib/types";

export type RolShell = "empresa" | "consultor" | "administrador";

export interface ItemMenu {
  href: string;
  label: string;
  icono: LucideIcon;
  /** Solo activo con la ruta exacta (p. ej. el panel general de admin). */
  exacto?: boolean;
  /** Otras rutas que pertenecen a este ítem (p. ej. /sugeridas dentro de Convocatorias). */
  alias?: string[];
  /** Etiqueta corta en la barra de pestañas inferior (móvil). */
  etiquetaTab?: string;
  /** RN-41, RF-120: la función del plan que abre la pantalla; sin ella, el ítem lleva candado. */
  funcion?: FuncionPlan;
}

export interface GrupoMenu {
  id: string;
  titulo: string;
  items: ItemMenu[];
}

export const PORTAL: Record<RolShell, string> = {
  empresa: "Portal empresa",
  consultor: "Portal consultor",
  administrador: "Panel administrativo",
};

// Menú corto del rediseño FundRadar. «Sugeridas para ti», «Guardadas» y
// «Beneficios tributarios» salen del menú y pasan a ser pestañas y chips de
// Convocatorias (Fase 4); sus rutas siguen vivas y cuentan como Convocatorias.
const EMPRESA: GrupoMenu[] = [
  {
    id: "general",
    titulo: "",
    items: [{ href: "/inicio", label: "Inicio", icono: House, etiquetaTab: "Inicio" }],
  },
  {
    id: "descubrir",
    titulo: "Descubrir",
    items: [
      {
        href: "/convocatorias",
        label: "Convocatorias",
        icono: Search,
        alias: ["/sugeridas", "/guardadas"],
        etiquetaTab: "Buscar",
      },
    ],
  },
  {
    id: "trabajo",
    titulo: "Mi trabajo",
    items: [
      { href: "/proyectos", label: "Proyectos", icono: Folder, etiquetaTab: "Proyectos" },
      { href: "/postulaciones", label: "Postulaciones", icono: ClipboardCheck, etiquetaTab: "Postular", funcion: "postulaciones" },
      { href: "/documentos", label: "Documentos con IA", icono: Sparkles, funcion: "documento_ia" },
    ],
  },
  {
    id: "consultores",
    titulo: "Consultores",
    items: [
      { href: "/consultores", label: "Directorio", icono: Users, funcion: "consultores" },
      { href: "/encargos", label: "Mis encargos", icono: BriefcaseBusiness, funcion: "consultores" },
    ],
  },
  {
    id: "cuenta",
    titulo: "Cuenta",
    items: [
      { href: "/suscripcion", label: "Plan y créditos", icono: CreditCard },
      { href: "/ajustes", label: "Ajustes", icono: SlidersHorizontal },
    ],
  },
];

const CONSULTOR: GrupoMenu[] = [
  {
    id: "general",
    titulo: "General",
    items: [{ href: "/consultor/perfil", label: "Mi perfil", icono: User, etiquetaTab: "Perfil" }],
  },
  {
    id: "trabajo",
    titulo: "Trabajo",
    items: [
      { href: "/consultor/encargos", label: "Encargos", icono: BriefcaseBusiness, etiquetaTab: "Encargos" },
      { href: "/consultor/documentos", label: "Documentos", icono: Sparkles, etiquetaTab: "Documentos" },
    ],
  },
  {
    id: "cuenta",
    titulo: "Cuenta",
    items: [{ href: "/consultor/suscripcion", label: "Mi suscripción", icono: CreditCard, etiquetaTab: "Suscripción" }],
  },
];

/** El menú del panel vive en `menus-admin.ts`: el JS del portal no nombra sus rutas (RNF-35). */
export function gruposDeRol(rol: "empresa" | "consultor"): GrupoMenu[] {
  return rol === "empresa" ? EMPRESA : CONSULTOR;
}

/** El ítem activo es el de href más largo que coincide con la ruta (evita que
 *  /admin/consultores se marque también en /admin/consultores/revision). */
export function itemActivo(
  grupos: GrupoMenu[],
  pathname: string,
  consulta: string = ""
): { grupo: GrupoMenu; item: ItemMenu } | null {
  let mejor: { grupo: GrupoMenu; item: ItemMenu } | null = null;
  const actual = new URLSearchParams(consulta);
  for (const grupo of grupos) {
    for (const item of grupo.items) {
      const [ruta, q] = item.href.split("?");
      const pide = new URLSearchParams(q ?? "");
      const consultaCoincide = [...pide.entries()].every(([k, v]) => actual.get(k) === v);
      // Sin consulta propia, el ítem no se marca si la consulta actual es la de otro ítem.
      const otroLaReclama = !q && grupos.some((g) => g.items.some((x) => x.href.startsWith(ruta + "?") && [...new URLSearchParams(x.href.split("?")[1]).entries()].every(([k, v]) => actual.get(k) === v)));
      const rutas = [ruta, ...(item.alias ?? [])];
      const coincideRuta = item.exacto
        ? pathname === ruta
        : rutas.some((r) => pathname === r || pathname.startsWith(r + "/"));
      const coincide = coincideRuta && consultaCoincide && !otroLaReclama;
      if (coincide && (!mejor || item.href.length > mejor.item.href.length)) mejor = { grupo, item };
    }
  }
  return mejor;
}

/**
 * Barra de pestañas inferior (móvil, < 1024 px): los ítems con `etiquetaTab`
 * van como pestañas y el resto del menú, en el «Más» de la empresa. El
 * consultor tiene 4 pestañas y no necesita «Más».
 */
const ORDEN_TABS_EMPRESA = ["/inicio", "/convocatorias", "/postulaciones", "/proyectos"];

export function tabsDeRol(rol: "empresa" | "consultor"): { tabs: ItemMenu[]; mas: ItemMenu[] } {
  const todos = gruposDeRol(rol).flatMap((g) => g.items);
  const tabs = todos.filter((i) => i.etiquetaTab);
  // Empresa: Inicio · Buscar · Postular · Proyectos (el menú lateral lista Proyectos primero).
  if (rol === "empresa") tabs.sort((a, b) => ORDEN_TABS_EMPRESA.indexOf(a.href) - ORDEN_TABS_EMPRESA.indexOf(b.href));
  return { tabs, mas: todos.filter((i) => !i.etiquetaTab) };
}
