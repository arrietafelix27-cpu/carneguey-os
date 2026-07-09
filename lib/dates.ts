/** Fecha de hoy en hora de Colombia, formato YYYY-MM-DD. */
export function bogotaToday(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  });
}
