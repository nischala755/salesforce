export function requireDpoRole(actor: { role: string }): void {
  if (actor.role !== "dpo") throw new Error("FORBIDDEN");
}
