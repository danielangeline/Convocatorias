import {
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileStack,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  Layers,
  Rss,
  Search,
  ShieldAlert,
  Sparkles,
  Tags,
  User,
  UserCheck,
  UserCog,
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

// Solo rutas que existen. Las opciones del diseño sin pantalla propia
// (Guardadas, Reseñas, Consumo de IA, Beneficios tributarios) quedan en el
// backlog de la bitácora 031.
const EMPRESA: GrupoMenu[] = [
  {
    id: "descubrir",
    titulo: "Descubrir",
    items: [{ href: "/convocatorias", label: "Convocatorias", icono: Search }],
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
    items: [{ href: "/suscripcion", label: "Plan y créditos", icono: CreditCard }],
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

const ADMIN: GrupoMenu[] = [
  {
    id: "general",
    titulo: "General",
    items: [{ href: "/admin", label: "Panel general", icono: LayoutDashboard, exacto: true }],
  },
  {
    id: "convocatorias",
    titulo: "Convocatorias",
    items: [
      { href: "/admin/convocatorias", label: "Convocatorias", icono: FileStack },
      { href: "/admin/fuentes", label: "Fuentes", icono: Rss },
      { href: "/admin/categorias", label: "Categorías", icono: Tags },
    ],
  },
  {
    id: "consultores",
    titulo: "Consultores",
    items: [
      { href: "/admin/consultores/revision", label: "Perfiles en revisión", icono: UserCheck },
      { href: "/admin/consultores", label: "Consultores", icono: Users },
      { href: "/admin/encargos", label: "Solicitudes al equipo", icono: ClipboardList },
    ],
  },
  {
    id: "suscripciones",
    titulo: "Suscripciones",
    items: [
      { href: "/admin/planes", label: "Planes", icono: Layers },
      { href: "/admin/suscripciones", label: "Suscripciones", icono: CreditCard },
    ],
  },
  {
    id: "ia",
    titulo: "Inteligencia artificial",
    items: [{ href: "/admin/plantillas", label: "Plantillas de la IA", icono: Sparkles }],
  },
  {
    id: "seguridad",
    titulo: "Seguridad",
    items: [{ href: "/admin/seguridad", label: "Eventos y bloqueos", icono: ShieldAlert }],
  },
];

// Solo el Propietario ve la sección; a los demás el servidor les responde 404 (RF-86).
const PROPIETARIO: GrupoMenu = {
  id: "propietario",
  titulo: "Propietario",
  items: [{ href: "/admin/administradores", label: "Administradores", icono: UserCog }],
};

export function gruposDeRol(rol: RolShell, esPropietario: boolean): GrupoMenu[] {
  if (rol === "empresa") return EMPRESA;
  if (rol === "consultor") return CONSULTOR;
  return esPropietario ? [...ADMIN, PROPIETARIO] : ADMIN;
}

/** El ítem activo es el de href más largo que coincide con la ruta (evita que
 *  /admin/consultores se marque también en /admin/consultores/revision). */
export function itemActivo(grupos: GrupoMenu[], pathname: string): { grupo: GrupoMenu; item: ItemMenu } | null {
  let mejor: { grupo: GrupoMenu; item: ItemMenu } | null = null;
  for (const grupo of grupos) {
    for (const item of grupo.items) {
      const coincide = item.exacto
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + "/");
      if (coincide && (!mejor || item.href.length > mejor.item.href.length)) mejor = { grupo, item };
    }
  }
  return mejor;
}
