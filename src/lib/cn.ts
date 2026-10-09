/** Junta classes condicionais sem depender de biblioteca externa. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
