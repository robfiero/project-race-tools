/**
 * Chart color palette utility.
 *
 * Returns an array of `count` colors where:
 *   index 0 → theme.chart[0]  (theme primary chart color)
 *   index 1 → theme.chart[1]  (theme secondary chart color)
 *   index 2 → theme.chart[2]
 *   index 3 → theme.chart[3]
 *   index 4+ → extended neutral colors, cycling if necessary
 */
import type { Theme } from './themes.ts';

// Carefully chosen to be visually distinct and readable across all built-in
// themes without clashing with the theme's own palette entries.
const EXTRA_COLORS = [
  '#f59e0b', // amber
  '#ec4899', // pink
  '#10b981', // emerald
  '#f97316', // orange
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#ef4444', // red
  '#6b7280', // slate-gray
  '#a16207', // yellow-brown
  '#0369a1', // sky-blue
  '#be185d', // fuchsia
];

export function chartPalette(theme: Theme, count: number): string[] {
  const full: string[] = [...theme.chart, ...EXTRA_COLORS];
  return Array.from({ length: count }, (_, i) => full[i % full.length]);
}

// Consistent gender color assignment using the active theme palette.
// Always use this instead of hard-coding colors per gender.
export function genderColors(theme: Theme): { M: string; F: string; NB: string; Unknown: string } {
  return { F: theme.chart[0], M: theme.chart[1], NB: theme.chart[2], Unknown: '#bbb' };
}
