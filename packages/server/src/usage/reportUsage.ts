export const REPORT_RUN_TYPES = [
  'registration_single_year',
  'registration_multi_year',
  'results_single_year',
  'results_multi_year',
] as const;

export type ReportRunType = (typeof REPORT_RUN_TYPES)[number];

export type ReportRunCounts = Record<ReportRunType, number>;

const reportRunCounts: ReportRunCounts = {
  registration_single_year: 0,
  registration_multi_year: 0,
  results_single_year: 0,
  results_multi_year: 0,
};

function isReportRunType(reportType: string): reportType is ReportRunType {
  return REPORT_RUN_TYPES.includes(reportType as ReportRunType);
}

export function incrementReportRun(reportType: ReportRunType): void {
  if (!isReportRunType(reportType)) {
    throw new Error(`Unknown report run type: ${reportType}`);
  }

  reportRunCounts[reportType] += 1;
  console.info(`report_run type=${reportType} count=${reportRunCounts[reportType]}`);
}

export function getReportRunCounts(): ReportRunCounts {
  return { ...reportRunCounts };
}

export function resetReportRunCountsForTests(): void {
  for (const reportType of REPORT_RUN_TYPES) {
    reportRunCounts[reportType] = 0;
  }
}
