/** Minutos de lectura estimados (~200 palabras por minuto en español). */
export function estimateReadMinutes(text: string, wpm = 200): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wpm));
}
