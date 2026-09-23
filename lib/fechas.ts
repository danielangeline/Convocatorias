/**
 * Hoy en Colombia, AAAA-MM-DD. Una convocatoria vence al terminar su día de
 * cierre en hora de Bogotá (RN-02, CU-06); en la base, la misma regla es
 * `privado.hoy_colombia()`. Sirve en el servidor y en el navegador.
 */
export function hoyColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}
