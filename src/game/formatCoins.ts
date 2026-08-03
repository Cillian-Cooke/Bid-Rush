/** Compact coin labels that stay readable in tight score tiles. */
export function formatCoins(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const n = Math.trunc(value);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (abs < 1_000) return `${sign}${abs}`;

  // Extremely large: scientific so it always fits
  if (abs >= 1_000_000_000_000_000) {
    return `${sign}${toExp(abs)}`;
  }

  if (abs >= 1_000_000_000_000) return `${sign}${compact(abs, 1_000_000_000_000, 'T')}`;
  if (abs >= 1_000_000_000) return `${sign}${compact(abs, 1_000_000_000, 'B')}`;
  if (abs >= 1_000_000) return `${sign}${compact(abs, 1_000_000, 'M')}`;
  return `${sign}${compact(abs, 1_000, 'k')}`;
}

function compact(abs: number, div: number, suffix: string): string {
  const raw = abs / div;
  // Keep enough precision to stay distinct, but prefer short labels.
  let text: string;
  if (raw >= 100) {
    text = String(Math.round(raw));
  } else if (raw >= 10) {
    const rounded = Math.round(raw * 10) / 10;
    text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  } else {
    const rounded = Math.round(raw * 10) / 10;
    text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  // Avoid awkward 1000k — bump is handled by callers choosing the tier.
  if (text === '1000') {
    if (suffix === 'k') return '1M';
    if (suffix === 'M') return '1B';
    if (suffix === 'B') return '1T';
  }
  return `${text}${suffix}`;
}

function toExp(abs: number): string {
  const exp = abs.toExponential(1); // e.g. 1.2e+15
  return exp.replace('e+', 'e').replace(/\.0e/, 'e');
}

/** Signed compact delta for float labels (+1.2k / -850). */
export function formatCoinDelta(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) return '0';
  const sign = delta > 0 ? '+' : '-';
  return `${sign}${formatCoins(Math.abs(delta)).replace(/^-/, '')}`;
}
