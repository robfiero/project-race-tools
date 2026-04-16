import type { Adapter } from './types.js';
import { ultraSignupAdapter } from './ultrasignup.js';

// Registry of all known adapters, in detection-priority order.
// Add new platform adapters here as they are implemented.
export const adapters: Adapter[] = [
  ultraSignupAdapter,
];

export function detectAdapter(headers: string[]): Adapter | null {
  for (const adapter of adapters) {
    if (adapter.detect(headers)) return adapter;
  }
  return null;
}

export type { Adapter } from './types.js';
