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
}

export interface RegistrantProfile {
  count: number;
  femalePercent: number;
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
  femalePercent: number;
  avgAge: number | null;
  medianAge: number | null;
  medianDistanceMiles: number | null;  // null if no venue
  localPercent: number | null;
  destinationPercent: number | null;
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
  femalePercent: TrendPoint[];
  medianAge: TrendPoint[];
  meanAge: TrendPoint[];
  stateCount: TrendPoint[];
  countryCount: TrendPoint[];
  internationalPercent: TrendPoint[];
  nonBinaryPercent: TrendPoint[];
  malePercent: TrendPoint[];
  compedPercent: TrendPoint[];
  couponUsagePercent: TrendPoint[];
  // Empty arrays when not all intervals have venue data
  medianDistanceMiles: TrendPoint[];
  localPercent: TrendPoint[];
  destinationPercent: TrendPoint[];
}

export interface ComparisonStats {
  intervals: IntervalStats[];
  trends: ComparisonTrends;
  hasDistanceTrend: boolean;
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
