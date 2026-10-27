import {
  ClipboardList,
  CreditCard,
  FileStack,
  Gauge,
  Layers,
  LayoutDashboard,
  Rss,
  ShieldAlert,
  Sparkles,
  Tags,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";
import type { GrupoMenu } from "./menus";

// Menú del panel (RF-85, RF-86). Solo lo importa `AdminShell`, que solo se
// carga en /admin: el JS del portal y de las pantallas públicas no nombra el
// panel (RNF-35).
const ADMIN: GrupoMenu[] = [
  {
    id: "general",
    titulo: "General",
    items: [{ href: "/admin", label: "Panel general", icono: LayoutDashboard, exacto: true }],
  },
  {
    id: "convocatorias",
    titulo: "Catálogo",
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
    items: [
      { href: "/admin/plantillas", label: "Plantillas", icono: Sparkles },
      { href: "/admin/consumo-ia", label: "Consumo de IA", icono: Gauge },
    ],
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

export function gruposAdmin(esPropietario: boolean): GrupoMenu[] {
  return esPropietario ? [...ADMIN, PROPIETARIO] : ADMIN;
}
