import { redirect } from "next/navigation";

// Rediseño FundRadar: «Sugeridas para ti» es una pestaña del catálogo (RF-106, CU-10).
// La ruta se conserva para enlaces y favoritos.
export default function SugeridasPage() {
  redirect("/convocatorias?tab=sugeridas");
}
