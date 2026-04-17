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
}

export interface RegistrantProfile {
  count: number;
  femalePercent: number;
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
  femalePercent: number;
  avgAge: number | null;
  medianAge: number | null;
  medianDistanceMiles: number | null;
  localPercent: number | null;
  destinationPercent: number | null;
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
  medianDistanceMiles: TrendPoint[];
  localPercent: TrendPoint[];
  destinationPercent: TrendPoint[];
}

export interface ComparisonStats {
  intervals: IntervalStats[];
  trends: ComparisonTrends;
  hasDistanceTrend: boolean;
}
