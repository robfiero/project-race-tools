// Client-side mirror of the server's RaceStats types.
// Keep in sync with packages/server/src/types.ts.

export interface UploadResponse {
  sessionId: string;
  raceName: string;
  adapterName: string;
  participantCount: number;
  events: string[];
  venueGeocoded: boolean;
  timezone: string;
}

export interface StatsResponse {
  sessionId: string;
  events: string[];
  selectedEvents: string[];
  stats: RaceStats;
}

export interface RaceStats {
  summary: SummaryStats;
  gender: GenderStats;
  age: AgeStats;
  geographic: GeographicStats;
  distance: DistanceStats | null;
  registration: RegistrationStats;
  crossEvent: CrossEventStats;
  participation: ParticipationStats;
  teams: TeamStats;
}

export interface SummaryStats {
  totalParticipants: number;
  activeParticipants: number;
  events: EventSummary[];
}

export interface EventSummary {
  name: string;
  count: number;
  activeCount: number;
}

export interface GenderStats {
  male: number;
  female: number;
  nonBinary: number;
  unknown: number;
  malePercent: number;
  femalePercent: number;
  nonBinaryPercent: number;
}

export interface AgeStats {
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  buckets: AgeBucket[];
}

export interface AgeBucket {
  label: string;
  count: number;
}

export interface GeographicStats {
  byState: Record<string, number>;
  byCountry: Record<string, number>;
  topStates: Array<{ state: string; count: number }>;
  topCountries: Array<{ country: string; count: number }>;
  usParticipants: number;
  internationalParticipants: number;
  unknownLocationParticipants?: number;
}

export interface DistanceStats {
  venueAddress: string;
  medianMiles: number;
  meanMiles: number;
  local: number;
  regional: number;
  destination: number;
  buckets: DistanceBucket[];
}

export interface DistanceBucket {
  label: string;
  count: number;
}

export interface RegistrationStats {
  byMonth: Array<{ month: string; count: number }>;
  cumulative: Array<{ date: string; count: number; total: number }>;
  byDayOfWeek: Array<{ day: string; count: number }>;
  byHourOfDay: Array<{ hour: number; label: string; count: number }>;
  earlyProfile: RegistrantProfile;
  lateProfile: RegistrantProfile;
  couponUsageCount: number;
  couponUsagePercent: number;
  byEvent: EventRegistrationStats[];
}

export interface EventRegistrationStats {
  eventName: string;
  count: number;
  byMonth: Array<{ month: string; count: number }>;
  cumulative: Array<{ date: string; count: number; total: number }>;
  earlyProfile: RegistrantProfile;
  lateProfile: RegistrantProfile;
  couponUsageCount: number;
  couponUsagePercent: number;
}

export interface RegistrantProfile {
  count: number;
  femalePercent: number;
  malePercent: number;
  nonBinaryPercent: number;
  avgAge: number | null;
  medianDistanceMiles: number | null;
}

export interface CrossEventStats {
  rows: CrossEventRow[];
}

export interface CrossEventRow {
  name: string;
  count: number;
  male: number;
  female: number;
  nonBinary: number;
  malePercent: number;
  femalePercent: number;
  nonBinaryPercent: number;
  avgAge: number | null;
  medianAge: number | null;
  medianDistanceMiles: number | null;
  localPercent: number | null;        // < 50 mi
  regionalPercent: number | null;     // 50–199 mi
  destinationPercent: number | null;  // ≥ 200 mi
}

export interface ParticipantStatusCounts {
  creditCardActive: number;
  creditCardDropped: number;
  paypalActive: number;
  paypalDropped: number;
  waitlistNeverInvited: number;
  waitlistWithdrawnDeclined: number;
  specialCaseA: number;
  specialCaseB: number;
  relayTeamMember: number;
  paymentPendingActive: number;
  paymentPendingDropped: number;
  couponActive: number;
  couponDropped: number;
  giftCardActive: number;
  giftCardDropped: number;
  compedActive: number;
  compedDropped: number;
  other: number;
}

export interface ParticipantStatusStats extends ParticipantStatusCounts {
  hasStatementData: boolean;
  byEvent: Array<{ eventName: string } & ParticipantStatusCounts>;
}

export interface ParticipationStats {
  totalRegistered: number;
  paid: number;
  comped: number;
  compedPercent: number;
  relayJoins: number;
  relayJoinsPercent: number;
  dropped: number;
  droppedPercent: number;
  removed: number;
  removedPercent: number;
  statusBreakdown: ParticipantStatusStats;
}

export interface TeamStats {
  hasTeams: boolean;
  totalTeams: number;
  avgTeamSize: number;
  soloParticipants: number;
  teamParticipants: number;
  allMaleTeams: number;
  allFemaleTeams: number;
  mixedTeams: number;
  teamAvgAge: number | null;
  soloAvgAge: number | null;
}

// ─── Comparison types ────────────────────────────────────────────────────────

export interface TrendPoint {
  label: string;
  value: number | null;
}

export interface IntervalStats {
  sessionId: string;
  label: string;
  raceName: string;
  participantCount: number;
  stats: RaceStats;
}

export interface ComparisonTrends {
  participantCount: TrendPoint[];
  activeParticipants: TrendPoint[];
  paid: TrendPoint[];
  femalePercent: TrendPoint[];
  medianAge: TrendPoint[];
  meanAge: TrendPoint[];
  minAge: TrendPoint[];
  maxAge: TrendPoint[];
  stateCount: TrendPoint[];
  countryCount: TrendPoint[];
  internationalPercent: TrendPoint[];
  internationalCount: TrendPoint[];
  nonBinaryPercent: TrendPoint[];
  malePercent: TrendPoint[];
  comped: TrendPoint[];
  dropped: TrendPoint[];
  removed: TrendPoint[];
  relayJoins: TrendPoint[];
  couponUsageCount: TrendPoint[];
  creditCardActive: TrendPoint[];
  paypalActive: TrendPoint[];
  couponActive: TrendPoint[];
  giftCardActive: TrendPoint[];
  paymentPending: TrendPoint[];
  creditCardDropped: TrendPoint[];
  paypalDropped: TrendPoint[];
  paidDropped: TrendPoint[];
  waitlistNeverInvited: TrendPoint[];
  waitlistWithdrawnDeclined: TrendPoint[];
  compedPercent: TrendPoint[];
  droppedPercent: TrendPoint[];
  removedPercent: TrendPoint[];
  relayJoinsPercent: TrendPoint[];
  couponUsagePercent: TrendPoint[];
  earlyFemalePercent: TrendPoint[];
  lateFemalePercent: TrendPoint[];
  earlyMalePercent: TrendPoint[];
  lateMalePercent: TrendPoint[];
  earlyAvgAge: TrendPoint[];
  lateAvgAge: TrendPoint[];
  medianDistanceMiles: TrendPoint[];
  localPercent: TrendPoint[];
  regionalPercent: TrendPoint[];
  destinationPercent: TrendPoint[];
}

export interface StateTrendRow {
  state: string;
  counts: TrendPoint[];
}

export interface CrossEventTrendRow {
  eventName: string;
  participantCount: TrendPoint[];
  femalePercent: TrendPoint[];
  malePercent: TrendPoint[];
  nonBinaryPercent: TrendPoint[];
  avgAge: TrendPoint[];
  medianAge: TrendPoint[];
  medianDistanceMiles: TrendPoint[];
}

export interface ComparisonStats {
  intervals: IntervalStats[];
  trends: ComparisonTrends;
  hasDistanceTrend: boolean;
  crossEventTrends: CrossEventTrendRow[];
  topStateTrends: StateTrendRow[];
}

// ─── Race Results types ───────────────────────────────────────────────────────

export type EventType = 'fixed-distance' | 'fixed-time';

export interface ResultsUploadResponse {
  sessionId: string;
  raceName: string;
  adapterName: string;
  resultCount: number;
}

export interface ResultsStatsResponse {
  sessionId: string;
  raceName: string;
  stats: ResultsStats;
  weatherData?: WeatherData;
}

export interface AgeGroupPerformanceRow {
  ageGroup: string;
  total: number;
  finishers: number;
  maleFinishers: number;
  femaleFinishers: number;
  nonBinaryFinishers: number;
  finishRate: number;
  dnf: number;
  dnfRate: number;
  dns: number;
  dnsRate: number;
  // Gender-specific entrant totals and finish rates:
  maleTotal: number;
  femaleTotal: number;
  nonBinaryTotal: number;
  maleFinishRate: number;
  femaleFinishRate: number;
  nonBinaryFinishRate: number;
  // Gender-specific pace — fixed-distance only (null for fixed-time):
  malePaceSecsPerMile: number | null;
  femalePaceSecsPerMile: number | null;
  nonBinaryPaceSecsPerMile: number | null;
  // Gender-specific distance — fixed-time only (null for fixed-distance):
  maleMiles: number | null;
  femaleMiles: number | null;
  nonBinaryMiles: number | null;
  // Overall performance — fixed-distance (null for fixed-time):
  medianPaceSecsPerMile: number | null;
  fastestPaceSecsPerMile: number | null;
  slowestPaceSecsPerMile: number | null;
  // Overall performance — fixed-time (null for fixed-distance):
  medianMiles: number | null;
  maxMiles: number | null;
  minMiles: number | null;
}

export interface AgeGroupPerformanceStats {
  rows: AgeGroupPerformanceRow[];
  eventType: EventType;
}

export interface AgeGroupPerformanceByEvent {
  eventName: string;
  eventType: EventType;
  rows: AgeGroupPerformanceRow[];
}

export interface DivisionPerformanceRow {
  division: string;
  total: number;
  finishers: number;
  maleFinishers: number;
  femaleFinishers: number;
  nonBinaryFinishers: number;
  finishRate: number;
  dnf: number;
  dnfRate: number;
  dns: number;
  dnsRate: number;
  medianPaceSecsPerMile: number | null;
  fastestPaceSecsPerMile: number | null;
  slowestPaceSecsPerMile: number | null;
  medianMiles: number | null;
  maxMiles: number | null;
  minMiles: number | null;
}

export interface DivisionPerformanceStats {
  rows: DivisionPerformanceRow[];
  eventType: EventType;
}

export interface DivisionPerformanceByEvent {
  eventName: string;
  eventType: EventType;
  rows: DivisionPerformanceRow[];
}

export interface PerformanceBandRow {
  label: string;
  finishers: number;
  percentOfFinishers: number;
  maleFinishers: number;
  femaleFinishers: number;
  nonBinaryFinishers: number;
  meanAge: number | null;
  medianAge: number | null;
  fastestSeconds: number | null;
  medianSeconds: number | null;
  slowestSeconds: number | null;
  medianPaceSecsPerMile: number | null;
  farthestMiles: number | null;
  medianMiles: number | null;
  shortestMiles: number | null;
}

export interface PerformanceBandStats {
  rows: PerformanceBandRow[];
  eventType: EventType;
  totalFinishers: number;
  events: Array<{
    eventName: string;
    rows: PerformanceBandRow[];
    eventType: EventType;
    totalFinishers: number;
  }>;
}

export interface AgeDistributionByEvent {
  eventName: string;
  eventType: EventType;
  finisherAge: AgeStats;
}

export interface GeographicDistributionByEvent {
  eventName: string;
  eventType: EventType;
  geographic: GeographicStats;
}

export interface ResultsStats {
  summary: ResultsSummaryStats;
  performance: PerformanceStats;
  demographics: ResultsDemographicsStats;
  ageDistributionByEvent: AgeDistributionByEvent[];
  geographic: GeographicStats;
  geographicDistributionByEvent: GeographicDistributionByEvent[];
  attrition: AttritionStats;
  crossEvent: ResultsCrossEventStats;
  ageGroupPerformance: AgeGroupPerformanceStats | null;
  ageGroupPerformanceByEvent: AgeGroupPerformanceByEvent[];
  divisionPerformance: DivisionPerformanceStats | null;
  divisionPerformanceByEvent: DivisionPerformanceByEvent[];
  performanceBands: PerformanceBandStats | null;
}

export interface ResultsSummaryStats {
  totalEntrants: number;
  finishers: number;
  dnf: number;
  dns: number;
  unofficial: number;
  dq: number;
  belowThreshold: number;
  finishRate: number;
  dnfRate: number;
  events: ResultsEventSummary[];
}

export interface ResultsEventSummary {
  name: string;
  eventType: EventType;
  totalEntrants: number;
  participantAge: AgeStats;
  gender: GenderStats;
  finishers: number;
  dnf: number;
  dns: number;
  finishRate: number;
  courseRecord: PerformanceValue | null;
  lastFinisher: PerformanceValue | null;
}

export interface PerformanceValue {
  display: string;
  seconds: number | null;
  miles: number | null;
  gender: string;
}

export interface PerformanceStats {
  events: EventPerformanceStats[];
}

export interface EventPerformanceStats {
  eventName: string;
  eventType: EventType;
  finishTime: FinishTimeStats | null;
  distanceAchieved: DistanceAchievedStats | null;
  paceStats: PaceStats | null;
}

export interface PaceBucket {
  label: string;
  count: number;
  minSecsPerMile: number;
  maxSecsPerMile: number;
}

export interface PaceGenderStats {
  gender: string;
  finishers: number;
  medianSecsPerMile: number;
  fastestSecsPerMile: number;
  slowestSecsPerMile: number;
}

export interface PaceAgeGroupStats {
  ageGroup: string;
  finishers: number;
  medianSecsPerMile: number;
  fastestSecsPerMile: number;
  slowestSecsPerMile: number;
}

export interface PaceStats {
  medianSecsPerMile: number;
  meanSecsPerMile: number;
  fastestSecsPerMile: number;
  slowestSecsPerMile: number;
  spreadSecsPerMile: number;
  buckets: PaceBucket[];
  byGender: PaceGenderStats[];
  byAgeGroup: PaceAgeGroupStats[];
}

export interface FinishTimeStats {
  medianSeconds: number;
  meanSeconds: number;
  fastestSeconds: number;
  slowestSeconds: number;
  percentiles: Array<{ label: string; seconds: number }>;
  buckets: Array<{ label: string; total: number; male: number; female: number; nonBinary: number }>;
  byGender: Array<{ gender: string; finishers: number; medianSeconds: number | null; meanSeconds: number | null; fastestSeconds: number | null; slowestSeconds: number | null }>;
}

export interface DistanceAchievedStats {
  medianMiles: number;
  meanMiles: number;
  maxMiles: number;
  minMiles: number;
  spreadMiles: number;
  percentiles: Array<{ label: string; miles: number }>;
  buckets: Array<{ label: string; total: number; male: number; female: number; nonBinary: number }>;
  distBuckets: Array<{ label: string; count: number }>;
  byGender: Array<{ gender: string; finishers: number; medianMiles: number | null; meanMiles: number | null; maxMiles: number | null; minMiles: number | null }>;
  byAgeGroup: Array<{ ageGroup: string; finishers: number; medianMiles: number | null; meanMiles: number | null; maxMiles: number | null; minMiles: number | null }>;
}

export interface ResultsDemographicsStats {
  gender: GenderStats;
  age: AgeStats;
  finisherGender: GenderStats;
  finisherAge: AgeStats;
  byGenderAndAge: GenderAgeGroupRow[];
  finisherAgeByGender: Array<{ gender: 'M' | 'F' | 'NB'; min: number | null; max: number | null; median: number | null }>;
}

export interface GenderAgeGroupRow {
  ageGroup: string;
  total: number;
  male: number;
  female: number;
  nonBinary: number;
  maleFinishCount: number;
  femaleFinishCount: number;
}

export interface AttritionStats {
  overall: AttritionRow;
  byGender: AttritionRow[];
  byEvent: AttritionRow[];
}

export interface AttritionRow {
  name: string;
  total: number;
  starters: number;
  finished: number;
  dnf: number;
  dns: number;
  startRate: number;
  finishRate: number;
  dnfRate: number;
  dnsRate: number;
}

export interface ResultsCrossEventStats {
  rows: ResultsCrossEventRow[];
}

export interface ResultsCrossEventRow {
  name: string;
  eventType: EventType;
  totalEntrants: number;
  finishers: number;
  finishRate: number;
  maleFinishers: number;
  femaleFinishers: number;
  nonBinaryFinishers: number;
  malePercent: number;
  femalePercent: number;
  nonBinaryPercent: number;
  avgAge: number | null;
  courseRecord: string | null;
  lastFinisher: string | null;
  fastestSeconds: number | null;
  medianSeconds: number | null;
  lastSeconds: number | null;
  avgPaceSecsPerMile: number | null;
  medianPaceSecsPerMile: number | null;
  farthestMiles: number | null;
  medianMiles: number | null;
  meanMiles: number | null;
  shortestMiles: number | null;
  spreadMiles: number | null;
}

// ─── Results multi-year comparison types ─────────────────────────────────────

export interface ResultsIntervalStats {
  sessionId: string;
  label: string;
  raceName: string;
  resultCount: number;
  stats: ResultsStats;
  weatherData?: WeatherData;
}

export interface ResultsComparisonTrends {
  totalEntrants: TrendPoint[];
  finishers: TrendPoint[];
  finishRate: TrendPoint[];
  dnfRate: TrendPoint[];
  medianFinishTimeSeconds: TrendPoint[];
  medianDistanceMiles: TrendPoint[];
  femaleFinisherPercent: TrendPoint[];
  nbFinisherPercent: TrendPoint[];
  medianFinisherAge: TrendPoint[];
}

export interface ResultsComparisonStats {
  intervals: ResultsIntervalStats[];
  trends: ResultsComparisonTrends;
  primaryEventType: EventType;
}

// ─── Weather types ────────────────────────────────────────────────────────────

export interface WeatherSnapshot {
  timeIso: string;
  label: string;
  tempF: number;
  feelsLikeF: number;
  weatherCode: number;
  weatherDesc: string;
  cloudCoverPct: number;
  windMph: number;
  windGustMph: number;
  windDir: string;
  precipInch: number;
  precipType: string;
  precipIntensity: string;
}

export interface WeatherData {
  venueAddress: string;
  raceStartIso: string;
  raceEndIso: string;
  snapshots: WeatherSnapshot[];
}
