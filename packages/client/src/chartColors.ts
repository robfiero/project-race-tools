/**
 * Chart color palette utility.
 *
 * chartPalette()      — theme-driven colors for single-year charts (buckets, categories)
 * comparisonPalette() — stable, theme-independent colors for comparison interval/year series
 * genderColors()      — theme-driven semantic gender colors
 */
import type { Theme } from './themes.ts';

// Stable palette for comparison interval/year series in multi-year charts.
// Order maps to selected intervals: earliest → latest.
// These are intentionally theme-independent so year colors are consistent across all themes.
const COMPARISON_PALETTE = [
  '#2563EB', // Blue   — interval 1
  '#D97706', // Amber  — interval 2
  '#9333EA', // Purple — interval 3
  '#0891B2', // Teal   — interval 4
  '#BE185D', // Rose   — interval 5
] as const;

// Human-readable names used for accessible aria-labels on year chips.
const COMPARISON_PALETTE_NAMES = ['blue', 'amber', 'purple', 'teal', 'rose'] as const;

export function comparisonPalette(count: number): string[] {
  return Array.from({ length: count }, (_, i) => COMPARISON_PALETTE[i % COMPARISON_PALETTE.length]);
}

export function comparisonPaletteName(index: number): string {
  return COMPARISON_PALETTE_NAMES[index % COMPARISON_PALETTE_NAMES.length];
}

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
