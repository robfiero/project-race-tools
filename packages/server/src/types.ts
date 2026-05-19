// Canonical participant record — all PII removed at parse time.
// Only fields useful for aggregate statistics are retained.
export interface ParticipantRecord {
  orderId: string;
  registrationDate: Date;
  event: string;           // e.g. "30-Hour Ultramarathon"
  orderType: string;       // e.g. "Credit Card"
  hasCoupon: boolean;
  gender: 'M' | 'F' | 'NB' | 'Unknown';
  identifiedGender: string; // free-form self-identified gender if provided
  age: number | null;
  state: string;           // US state abbreviation, province, or blank
  country: string;         // e.g. "USA", "CAN"
  zipCode: string;         // retained for distance calculation only, not PII on its own
  removed: boolean;
  statementId: string;  // non-empty when a payment transaction exists (UltraSignup-specific)
  bib: string;
  isTeamCaptain: boolean;
  teamName: string;
  isComped: boolean;       // true if registration fee was fully waived
  isRelayJoin: boolean;    // true if comped relay non-captain (captain-pays model)
  droppingFromRace: boolean;
  refundStatus: string;
}

// What the stats engine computes and stores per session
export interface SessionData {
  sessionId: string;
  createdAt: Date;
  raceName: string;          // display name entered by the race director
  venueAddress: string | null;
  venueLat: number | null;
  venueLng: number | null;
  timezone: string;         // IANA timezone name for interpreting registration timestamps
  events: string[];         // distinct event names in this upload
  participants: ParticipantRecord[];
}

// Computed statistics returned to the client
export interface RaceStats {
  summary: SummaryStats;
  gender: GenderStats;
  age: AgeStats;
  geographic: GeographicStats;
  distance: DistanceStats | null;  // null if no venue provided
  registration: RegistrationStats;
  crossEvent: CrossEventStats;
  participation: ParticipationStats;
  teams: TeamStats;
}

export interface SummaryStats {
  totalParticipants: number;
  activeParticipants: number;  // excludes removed/dropped
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
  local: number;       // < 50 miles
  regional: number;    // 50–200 miles
  destination: number; // 200+ miles
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
  earlyProfile: RegistrantProfile;   // first quartile by registration date
  lateProfile: RegistrantProfile;    // last quartile by registration date
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
  medianDistanceMiles: number | null;  // null if no venue
}

export interface CrossEventStats {
  // Only populated when > 1 distinct event is present
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
  medianDistanceMiles: number | null;  // null if no venue
  localPercent: number | null;        // < 50 mi
  regionalPercent: number | null;     // 50–199 mi
  destinationPercent: number | null;  // ≥ 200 mi
}

export interface ParticipantStatusCounts {
  creditCardActive: number;    // Credit Card order type, statementId present, active
  creditCardDropped: number;   // Credit Card order type, statementId present, removed/dropped
  paypalActive: number;        // PayPal order type, statementId present, active
  paypalDropped: number;       // PayPal order type, statementId present, removed/dropped
  waitlistNeverInvited: number;
  waitlistWithdrawnDeclined: number;
  specialCaseA: number;      // blank orderType, removed=TRUE, statementId present
  specialCaseB: number;      // blank orderType, removed=FALSE, statementId present
  relayTeamMember: number;      // captain-pays relay join (isRelayJoin=true)
  paymentPendingActive: number; // known paid processor, no statement yet, active
  paymentPendingDropped: number;// known paid processor, no statement yet, removed
  couponActive: number;         // 100% Coupon order type, non-relay, active
  couponDropped: number;     // 100% Coupon order type, non-relay, removed
  giftCardActive: number;    // Gift Card order type, active
  giftCardDropped: number;   // Gift Card order type, removed
  compedActive: number;      // blank or "Comp" orderType, no statement, fully-waived fee, active
  compedDropped: number;     // blank or "Comp" orderType, fully-waived fee, removed
  other: number;
}

export interface ParticipantStatusStats extends ParticipantStatusCounts {
  hasStatementData: boolean;  // true when at least one participant has a statementId
  byEvent: Array<{ eventName: string } & ParticipantStatusCounts>;
}

export interface ParticipationStats {
  totalRegistered: number;
  paid: number;
  comped: number;
  compedPercent: number;
  relayJoins: number;      // captain-pays relay members (comped non-captains); shown separately
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
  label: string;   // interval label ("2023", "Spring 2025", etc.)
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
  // Status-breakdown counts (match single-year Registration Status Breakdown table)
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
  // Empty arrays when not all intervals have venue data
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

export type FinishStatus = 1 | 2 | 3 | 4 | 5 | 6;
// 1=Finished, 2=DNF, 3=DNS, 4=Unofficial, 5=DQ, 6=Below threshold

export type EventType = 'fixed-distance' | 'fixed-time';

export interface ResultRecord {
  bib: string;
  age: number | null;
  gender: 'M' | 'F' | 'NB' | 'Unknown';
  city: string;
  state: string;
  country: string;
  distanceMiles: number | null;
  timeSeconds: number | null;
  finishStatus: FinishStatus;
  overallPlace: number | null;
  divisionName: string;
}

export interface ResultsSessionData {
  sessionId: string;
  createdAt: Date;
  raceName: string;
  results: ResultRecord[];
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
  // Fixed-distance (null for fixed-time):
  medianPaceSecsPerMile: number | null;
  fastestPaceSecsPerMile: number | null;
  slowestPaceSecsPerMile: number | null;
  // Fixed-time (null for fixed-distance):
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
  // Fixed-distance (null for fixed-time):
  fastestSeconds: number | null;
  medianSeconds: number | null;
  slowestSeconds: number | null;
  medianPaceSecsPerMile: number | null;
  // Fixed-time (null for fixed-distance):
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
  gender: 'M' | 'F' | 'NB' | 'Unknown';
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
  // Fixed-distance performance (null for fixed-time):
  fastestSeconds: number | null;
  medianSeconds: number | null;
  lastSeconds: number | null;
  avgPaceSecsPerMile: number | null;
  medianPaceSecsPerMile: number | null;
  // Fixed-time performance (null for fixed-distance):
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
  medianFinishTimeSeconds: TrendPoint[];   // empty when fixed-time event
  medianDistanceMiles: TrendPoint[];       // empty when fixed-distance event
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
  timeIso: string;          // ISO datetime in local timezone
  label: string;            // "Race Start", "+6h", "+12h", "Race End"
  tempF: number;
  feelsLikeF: number;
  weatherCode: number;      // WMO weather code
  weatherDesc: string;      // human-readable WMO description
  cloudCoverPct: number;
  windMph: number;
  windGustMph: number;
  windDir: string;          // compass direction e.g. "NW"
  precipInch: number;
  precipType: string;       // "rain" | "snow" | "wintry mix" | ""
  precipIntensity: string;  // "light" | "moderate" | "heavy" | ""
}

export interface WeatherData {
  venueAddress: string;
  raceStartIso: string;
  raceEndIso: string;
  snapshots: WeatherSnapshot[];
}
