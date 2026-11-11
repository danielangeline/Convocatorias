import { redirect } from "next/navigation";

// Rediseño FundRadar: «Guardadas» es una pestaña del catálogo (RF-103, CU-45).
// La ruta se conserva para enlaces, favoritos y los avisos de la campana.
export default function GuardadasPage() {
  redirect("/convocatorias?tab=guardadas");
}
