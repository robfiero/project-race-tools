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
  localPercent: number | null;
  destinationPercent: number | null;
}

export interface ParticipantStatusCounts {
  paidActive: number;
  paidDropped: number;
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
  paidActive: TrendPoint[];
  couponActive: TrendPoint[];
  giftCardActive: TrendPoint[];
  paymentPending: TrendPoint[];
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

export interface ResultsStats {
  summary: ResultsSummaryStats;
  performance: PerformanceStats;
  demographics: ResultsDemographicsStats;
  geographic: GeographicStats;
  attrition: AttritionStats;
  crossEvent: ResultsCrossEventStats;
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
}

export interface FinishTimeStats {
  medianSeconds: number;
  meanSeconds: number;
  fastestSeconds: number;
  slowestSeconds: number;
  percentiles: Array<{ label: string; seconds: number }>;
  buckets: Array<{ label: string; total: number; male: number; female: number; nonBinary: number }>;
  byGender: Array<{ gender: string; finishers: number; medianSeconds: number | null; fastestSeconds: number | null; slowestSeconds: number | null }>;
}

export interface DistanceAchievedStats {
  medianMiles: number;
  meanMiles: number;
  maxMiles: number;
  percentiles: Array<{ label: string; miles: number }>;
  buckets: Array<{ label: string; total: number; male: number; female: number; nonBinary: number }>;
  byGender: Array<{ gender: string; finishers: number; medianMiles: number | null; maxMiles: number | null; minMiles: number | null }>;
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
  finished: number;
  dnf: number;
  dns: number;
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
