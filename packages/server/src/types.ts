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
