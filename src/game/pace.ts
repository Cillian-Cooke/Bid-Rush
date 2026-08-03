/** Match pace from elapsed match time (including sudden death). Capped at 4×. */
export function matchPaceMult(elapsedMs: number): number {
  const minutes = elapsedMs / 60_000;
  if (minutes < 2) return 1;
  if (minutes < 3) return 1.25;
  if (minutes < 4) return 1.5;
  if (minutes < 5) return 2;
  // 5 min → 3×, 6+ → 4× (hard cap)
  return Math.min(4, Math.floor(minutes) - 2);
}

export function formatPaceMult(mult: number): string {
  const label = Number.isInteger(mult) ? String(mult) : String(mult);
  return `${label}×`;
}

export function paceAccent(mult: number): string {
  if (mult >= 4) return '#ef4444';
  if (mult >= 3) return '#f97316';
  if (mult >= 2) return '#eab308';
  if (mult >= 1.5) return '#fbbf24';
  return '#f59e0b';
}

export function paceLabel(mult: number): string {
  if (mult >= 4) return 'Market frenzy';
  if (mult >= 3) return 'Blazing market';
  if (mult >= 2) return 'Double time';
  if (mult >= 1.5) return 'Heating up';
  return 'Picking up speed';
}
