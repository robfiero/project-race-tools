import { beforeEach, describe, expect, it } from 'vitest';
import statsRouter from '../../routes/stats.js';
import usageSummaryRouter from '../../routes/usageSummary.js';
import { getReportRunCounts, resetReportRunCountsForTests } from '../../usage/reportUsage.js';

interface RouteLayer {
  route?: {
    stack: Array<{ handle: (req: unknown, res: unknown) => unknown | Promise<unknown> }>;
  };
}

function firstRouteHandler(router: unknown): (req: unknown, res: unknown) => unknown | Promise<unknown> {
  const stack = (router as { stack: RouteLayer[] }).stack;
  const handler = stack[0]?.route?.stack[0]?.handle;
  if (!handler) throw new Error('Expected router to have a route handler.');
  return handler;
}

async function invokeFirstRoute(
  router: unknown,
  req: Record<string, unknown> = {},
): Promise<{ status: number; body: unknown }> {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  await firstRouteHandler(router)(req, response);

  return { status: response.statusCode, body: response.body };
}

describe('usage summary route', () => {
  beforeEach(() => {
    resetReportRunCountsForTests();
  });

  it('returns the expected response shape', async () => {
    const response = await invokeFirstRoute(usageSummaryRouter);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      reportRuns: {
        registration_single_year: 0,
        registration_multi_year: 0,
        results_single_year: 0,
        results_multi_year: 0,
      },
    });
  });

  it('does not increment on a failed report request', async () => {
    const response = await invokeFirstRoute(statsRouter, {
      params: { sessionId: 'missing-session' },
      query: {},
    });

    expect(response.status).toBe(404);
    expect(getReportRunCounts()).toEqual({
      registration_single_year: 0,
      registration_multi_year: 0,
      results_single_year: 0,
      results_multi_year: 0,
    });
  });
});
