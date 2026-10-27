import {
  ClipboardCheck,
  CreditCard,
  FolderKanban,
  Bookmark,
  LayoutGrid,
  ReceiptText,
  Settings,
  WandSparkles,
  Handshake,
  Search,
  Sparkles,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type RolShell = "empresa" | "consultor" | "administrador";

export interface ItemMenu {
  href: string;
  label: string;
  icono: LucideIcon;
  /** Solo activo con la ruta exacta (p. ej. el panel general de admin). */
  exacto?: boolean;
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

// Solo rutas que existen. «Beneficios tributarios» es el catálogo con el tipo
// preseleccionado (RF-102); un href con consulta solo se marca activo cuando
// la consulta coincide.
const EMPRESA: GrupoMenu[] = [
  {
    id: "general",
    titulo: "General",
    items: [{ href: "/inicio", label: "Inicio", icono: LayoutGrid }],
  },
  {
    id: "descubrir",
    titulo: "Descubrir",
    items: [
      { href: "/convocatorias", label: "Convocatorias", icono: Search },
      { href: "/sugeridas", label: "Sugeridas para ti", icono: WandSparkles },
      { href: "/convocatorias?tipo=beneficio_tributario", label: "Beneficios tributarios", icono: ReceiptText },
      { href: "/guardadas", label: "Guardadas", icono: Bookmark },
    ],
  },
  {
    id: "trabajo",
    titulo: "Mi trabajo",
    items: [
      { href: "/proyectos", label: "Proyectos", icono: FolderKanban },
      { href: "/postulaciones", label: "Postulaciones", icono: ClipboardCheck },
      { href: "/documentos", label: "Documentos con IA", icono: Sparkles },
    ],
  },
  {
    id: "consultores",
    titulo: "Consultores",
    items: [
      { href: "/consultores", label: "Directorio", icono: Users },
      { href: "/encargos", label: "Mis encargos", icono: Handshake },
    ],
  },
  {
    id: "cuenta",
    titulo: "Cuenta",
    items: [
      { href: "/suscripcion", label: "Plan y créditos", icono: CreditCard },
      { href: "/ajustes", label: "Ajustes", icono: Settings },
    ],
  },
];

const CONSULTOR: GrupoMenu[] = [
  {
    id: "general",
    titulo: "General",
    items: [{ href: "/consultor/perfil", label: "Mi perfil", icono: User }],
  },
  {
    id: "trabajo",
    titulo: "Trabajo",
    items: [
      { href: "/consultor/encargos", label: "Encargos", icono: Handshake },
      { href: "/consultor/documentos", label: "Documentos", icono: Sparkles },
    ],
  },
  {
    id: "cuenta",
    titulo: "Cuenta",
    items: [{ href: "/consultor/suscripcion", label: "Mi suscripción", icono: CreditCard }],
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
      const coincideRuta = item.exacto ? pathname === ruta : pathname === ruta || pathname.startsWith(ruta + "/");
      const coincide = coincideRuta && consultaCoincide && !otroLaReclama;
      if (coincide && (!mejor || item.href.length > mejor.item.href.length)) mejor = { grupo, item };
    }
  }
  return mejor;
}
