/**
 * Departamentos de Colombia con su código DANE (RN-34, docs/05 §9.18). Es la
 * misma lista que siembra la migración `20260924100000` en `public.departamentos`;
 * `scripts/prueba-sugerencias.mjs` comprueba que coincidan. La ubicación se
 * compara solo por estos códigos: el texto libre queda como detalle.
 */
export const DEPARTAMENTOS: ReadonlyArray<{ codigo: string; nombre: string }> = [
  { codigo: "91", nombre: "Amazonas" },
  { codigo: "05", nombre: "Antioquia" },
  { codigo: "81", nombre: "Arauca" },
  { codigo: "88", nombre: "Archipiélago de San Andrés, Providencia y Santa Catalina" },
  { codigo: "08", nombre: "Atlántico" },
  { codigo: "11", nombre: "Bogotá D.C." },
  { codigo: "13", nombre: "Bolívar" },
  { codigo: "15", nombre: "Boyacá" },
  { codigo: "17", nombre: "Caldas" },
  { codigo: "18", nombre: "Caquetá" },
  { codigo: "85", nombre: "Casanare" },
  { codigo: "19", nombre: "Cauca" },
  { codigo: "20", nombre: "Cesar" },
  { codigo: "27", nombre: "Chocó" },
  { codigo: "23", nombre: "Córdoba" },
  { codigo: "25", nombre: "Cundinamarca" },
  { codigo: "94", nombre: "Guainía" },
  { codigo: "95", nombre: "Guaviare" },
  { codigo: "41", nombre: "Huila" },
  { codigo: "44", nombre: "La Guajira" },
  { codigo: "47", nombre: "Magdalena" },
  { codigo: "50", nombre: "Meta" },
  { codigo: "52", nombre: "Nariño" },
  { codigo: "54", nombre: "Norte de Santander" },
  { codigo: "86", nombre: "Putumayo" },
  { codigo: "63", nombre: "Quindío" },
  { codigo: "66", nombre: "Risaralda" },
  { codigo: "68", nombre: "Santander" },
  { codigo: "70", nombre: "Sucre" },
  { codigo: "73", nombre: "Tolima" },
  { codigo: "76", nombre: "Valle del Cauca" },
  { codigo: "97", nombre: "Vaupés" },
  { codigo: "99", nombre: "Vichada" },
];

const POR_CODIGO = new Map(DEPARTAMENTOS.map((d) => [d.codigo, d.nombre]));

export const esCodigoDepartamento = (codigo: string): boolean => POR_CODIGO.has(codigo);

export const nombreDepartamento = (codigo: string | null | undefined): string =>
  (codigo && POR_CODIGO.get(codigo)) || "";

/** "Nacional", o los departamentos por nombre; el detalle en texto va aparte. */
export function textoCobertura(c: { coberturaNacional: boolean; departamentos: string[] }): string {
  if (c.coberturaNacional) return "Nacional";
  const nombres = c.departamentos.map(nombreDepartamento).filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
  return nombres.join(", ") || "Sin cobertura";
}

/** Departamento del proyecto y, si lo hay, su detalle: "Atlántico · Barranquilla". */
export function textoUbicacionProyecto(p: { departamento: string | null; ubicacion: string }): string {
  return [nombreDepartamento(p.departamento), p.ubicacion.trim()].filter(Boolean).join(" · ");
}
