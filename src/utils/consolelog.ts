export function consolelog(value: unknown): void {
  console.dir(value, { depth: null });
}
