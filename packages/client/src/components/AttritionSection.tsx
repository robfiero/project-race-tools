import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import type { ParticipationStats, ParticipantStatusCounts, TeamStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import StatCard from './StatCard.tsx';
import { useTheme } from '../ThemeContext.tsx';
import './ChartSection.css';

interface Props {
  participation: ParticipationStats;
  teams: TeamStats;
  compact?: boolean;
  couponUsageCount?: number;
  couponUsagePercent?: number;
}

type StatusKey = keyof ParticipantStatusCounts;

interface StatusRowDef {
  key: StatusKey;
  label: string;
  chartLabel: string;
  note?: string;
}

// ─── Category definitions ─────────────────────────────────────────────────────

const ACTIVE_ROW_DEFS: StatusRowDef[] = [
  { key: 'creditCardActive',     label: 'Credit Card Active',               chartLabel: 'Credit Card Active' },
  { key: 'paypalActive',         label: 'PayPal Active',                    chartLabel: 'PayPal Active' },
  { key: 'couponActive',         label: '100% Coupon Active',               chartLabel: '100% Coupon Active' },
  { key: 'giftCardActive',       label: 'Gift Card Active',                 chartLabel: 'Gift Card Active' },
  { key: 'paymentPendingActive', label: 'Payment Pending (Next Statement)', chartLabel: 'Payment Pending' },
  { key: 'relayTeamMember',      label: 'Relay Team Member',                chartLabel: 'Relay Team Member', note: 'captain-pays model' },
  { key: 'compedActive',         label: 'Comped / Volunteer',               chartLabel: 'Comped / Volunteer' },
];

const DROPPED_ROW_DEFS: StatusRowDef[] = [
  { key: 'creditCardDropped',     label: 'Credit Card — Dropped',     chartLabel: 'Credit Card — Dropped' },
  { key: 'paypalDropped',         label: 'PayPal — Dropped',          chartLabel: 'PayPal — Dropped' },
  { key: 'giftCardDropped',       label: 'Gift Card — Dropped',       chartLabel: 'Gift Card — Dropped' },
  { key: 'couponDropped',         label: '100% Coupon — Dropped',     chartLabel: 'Coupon — Dropped' },
  { key: 'paymentPendingDropped', label: 'Payment Pending — Dropped', chartLabel: 'Pmt Pending — Dropped' },
  { key: 'compedDropped',         label: 'Comped — Dropped',          chartLabel: 'Comped — Dropped' },
];

const WAITLIST_ROW_DEFS: StatusRowDef[] = [
  { key: 'waitlistNeverInvited',      label: 'Waitlist Not Invited',                   chartLabel: 'Waitlist Not Invited' },
  { key: 'waitlistWithdrawnDeclined', label: 'Waitlist Withdrawn/Declined Invitation', chartLabel: 'Waitlist Withdrawn' },
];

// Only shown when non-zero — these should be zero after correct classification
const UNCLASSIFIED_ROW_DEFS: StatusRowDef[] = [
  { key: 'specialCaseB', label: 'Special Case B', chartLabel: 'Special Case B', note: 'blank order type, statement present' },
  { key: 'specialCaseA', label: 'Special Case A', chartLabel: 'Special Case A', note: 'blank order type, statement present, removed' },
  { key: 'other',        label: 'Unknown / Other', chartLabel: 'Unknown / Other', note: 'unrecognized order type or incomplete payment data' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sumDefs(defs: StatusRowDef[], sb: ParticipantStatusCounts): number {
  return defs.reduce((s, r) => s + sb[r.key], 0);
}

// Exported so DashboardPage can use the identical computation for the summary card.
export function computeTotalActive(sb: ParticipantStatusCounts): number {
  return sumDefs(ACTIVE_ROW_DEFS, sb);
}

function pctOf(count: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${(count / total * 100).toFixed(1)}%`;
}

function barChartHeight(rowCount: number): number {
  return Math.max(60, rowCount * 34 + 16);
}

// Returns XAxis props that ensure count axes never show fractional ticks.
// For small ranges (≤10) every integer is listed explicitly; larger ranges use
// Recharts auto-tick with allowDecimals=false.
function integerXAxisProps(data: Array<{ count: number }>): {
  allowDecimals: false;
  ticks?: number[];
} {
  const max = data.length === 0 ? 0 : Math.max(...data.map(d => d.count));
  if (max <= 10) {
    return { allowDecimals: false, ticks: Array.from({ length: max + 1 }, (_, i) => i) };
  }
  return { allowDecimals: false };
}

// ─── Coupon usage callout ─────────────────────────────────────────────────────

function CouponUsageCallout({ count, percent }: { count: number; percent: number | undefined }) {
  return (
    <div className="rd-coupon-callout">
      <p className="rd-coupon-callout-title">Coupon Usage</p>
      {count === 0 ? (
        <p className="rd-coupon-callout-body">0 registrants used a coupon or promo code.</p>
      ) : (
        <p className="rd-coupon-callout-body">
          <strong>{count.toLocaleString()}</strong> registrant{count !== 1 ? 's' : ''} used a coupon or promo code
          {percent !== undefined ? `, representing ${percent}% of registrants` : ''}.
          {' '}Coupon usage is tracked separately because it can overlap with registration status.
        </p>
      )}
    </div>
  );
}

// ─── Horizontal bar chart group ───────────────────────────────────────────────

function StatusChartGroup({ title, defs, sb, color }: {
  title: string;
  defs: StatusRowDef[];
  sb: ParticipantStatusCounts;
  color: string;
}) {
  const data = defs
    .filter(r => sb[r.key] > 0)
    .map(r => ({ label: r.chartLabel, count: sb[r.key] }));

  return (
    <div className="chart-subsection">
      <h3 className="chart-subsection-title">{title}</h3>
      {data.length === 0 ? (
        <p className="rd-empty-group">No records in this category.</p>
      ) : (
        <div className="chart-wrap chart-wrap--full" aria-hidden="true">
          <ResponsiveContainer width="100%" height={barChartHeight(data.length)}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} {...integerXAxisProps(data)} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={190} />
              <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Participants']} />
              <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} name="Participants">
                <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#555' }} formatter={(v: number) => v.toLocaleString()} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Grouped status table ─────────────────────────────────────────────────────

function StatusTableGroup({ title, defs, sb, totalLabel, totalCount, pctHeader }: {
  title: string;
  defs: StatusRowDef[];
  sb: ParticipantStatusCounts;
  totalLabel?: string;
  totalCount?: number;
  pctHeader?: string;
}) {
  const bodyRows = defs.filter(r => sb[r.key] > 0);
  const showPct   = !!pctHeader;
  const showTotal = totalLabel !== undefined && totalCount !== undefined;
  const colCount  = showPct ? 3 : 2;

  return (
    <div className="chart-subsection">
      <h3 className="chart-subsection-title">{title}</h3>
      <table className="stats-table">
        <caption className="sr-only">{title} — counts{showPct ? ' and percentages' : ''}</caption>
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Count</th>
            {showPct && <th scope="col">{pctHeader}</th>}
          </tr>
        </thead>
        <tbody>
          {bodyRows.length === 0 && (
            <tr>
              <td colSpan={colCount} className="rd-empty-group">No records in this category.</td>
            </tr>
          )}
          {bodyRows.map(r => (
            <tr key={r.key}>
              <td>
                {r.label}
                {r.note && <span className="status-note"> — {r.note}</span>}
              </td>
              <td>{sb[r.key].toLocaleString()}</td>
              {showPct && <td>{pctOf(sb[r.key], totalCount!)}</td>}
            </tr>
          ))}
          {showTotal && (
            <tr className="total-row">
              <td>{totalLabel}</td>
              <td>{totalCount!.toLocaleString()}</td>
              {showPct && <td>100%</td>}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type RdTab = 'charts' | 'table';

export default function ParticipationSection({
  participation, teams, compact = false, couponUsageCount, couponUsagePercent,
}: Props) {
  const { theme } = useTheme();
  const c0 = theme.chart[0];
  const [tab, setTab] = useState<RdTab>('charts');

  const { statusBreakdown } = participation;
  const hasStatement = statusBreakdown.hasStatementData;

  const totalActive   = sumDefs(ACTIVE_ROW_DEFS, statusBreakdown);
  const totalDropped  = sumDefs(DROPPED_ROW_DEFS, statusBreakdown);
  const hasUnclassified = hasStatement && UNCLASSIFIED_ROW_DEFS.some(r => statusBreakdown[r.key] > 0);

  const couponCount = couponUsageCount ?? 0;

  // Fallback values used when hasStatementData is false
  const active = participation.totalRegistered - participation.dropped - participation.removed;
  const total  = participation.totalRegistered;
  const fallbackChartData = [
    { label: 'Active',   count: active },
    ...(participation.dropped > 0 ? [{ label: 'Dropped', count: participation.dropped }] : []),
    ...(participation.removed > 0 ? [{ label: 'Removed', count: participation.removed }] : []),
    ...(participation.comped > 0  ? [{ label: 'Comped',  count: participation.comped }]  : []),
  ];
  function pctOfTotal(count: number): string {
    if (total === 0) return '—';
    return `${(count / total * 100).toFixed(1)}%`;
  }

  // ── Charts tab content ──
  const chartsPanel = hasStatement ? (
    <>
      <StatusChartGroup title="Current Registration Status" defs={ACTIVE_ROW_DEFS}   sb={statusBreakdown} color={c0} />
      <StatusChartGroup title="Dropped Status"              defs={DROPPED_ROW_DEFS}  sb={statusBreakdown} color={c0} />
      <StatusChartGroup title="Waitlist Status"             defs={WAITLIST_ROW_DEFS} sb={statusBreakdown} color={c0} />
      {hasUnclassified && (
        <StatusChartGroup title="Unclassified / Needs Review" defs={UNCLASSIFIED_ROW_DEFS} sb={statusBreakdown} color={c0} />
      )}
    </>
  ) : (
    <div className="chart-subsection">
      <div className="chart-wrap chart-wrap--full" aria-hidden="true">
        <ResponsiveContainer width="100%" height={barChartHeight(fallbackChartData.length)}>
          <BarChart data={fallbackChartData} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} {...integerXAxisProps(fallbackChartData)} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={80} />
            <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Participants']} />
            <Bar dataKey="count" fill={c0} radius={[0, 4, 4, 0]} name="Participants">
              <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#555' }} formatter={(v: number) => v.toLocaleString()} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // ── Table tab content ──
  const tablePanel = hasStatement ? (
    <>
      <StatusTableGroup
        title="Current Registration Status"
        defs={ACTIVE_ROW_DEFS}
        sb={statusBreakdown}
        totalLabel="Total Active"
        totalCount={totalActive}
        pctHeader="% of Active"
      />
      <StatusTableGroup
        title="Dropped Status"
        defs={DROPPED_ROW_DEFS}
        sb={statusBreakdown}
        totalLabel="Total Dropped"
        totalCount={totalDropped}
        pctHeader="% of Dropped"
      />
      <StatusTableGroup
        title="Waitlist Status"
        defs={WAITLIST_ROW_DEFS}
        sb={statusBreakdown}
      />
      {hasUnclassified && (
        <StatusTableGroup
          title="Unclassified / Needs Review"
          defs={UNCLASSIFIED_ROW_DEFS}
          sb={statusBreakdown}
          totalLabel="Total Unclassified"
          totalCount={sumDefs(UNCLASSIFIED_ROW_DEFS, statusBreakdown)}
        />
      )}
    </>
  ) : (
    <div className="chart-subsection">
      <h3 className="chart-subsection-title">Registration Status</h3>
      <table className="stats-table stats-table--narrow">
        <caption className="sr-only">Participation status summary</caption>
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Count</th>
            <th scope="col">% of registered</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Active</td>
            <td>{active.toLocaleString()}</td>
            <td>{pctOfTotal(active)}</td>
          </tr>
          {participation.dropped > 0 && (
            <tr>
              <td>Dropped</td>
              <td>{participation.dropped.toLocaleString()}</td>
              <td>{pctOfTotal(participation.dropped)}</td>
            </tr>
          )}
          {participation.removed > 0 && (
            <tr>
              <td>Removed</td>
              <td>{participation.removed.toLocaleString()}</td>
              <td>{pctOfTotal(participation.removed)}</td>
            </tr>
          )}
          {participation.comped > 0 && (
            <tr>
              <td>Comped <span className="status-note">(RD / volunteer)</span></td>
              <td>{participation.comped.toLocaleString()}</td>
              <td>{pctOfTotal(participation.comped)}</td>
            </tr>
          )}
          <tr className="total-row">
            <td>Total Registered</td>
            <td>{total.toLocaleString()}</td>
            <td>100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="chart-section">
      <SectionHeader title="Registration &amp; Drops" />

      {/* Tab strip — full mode only */}
      {!compact && (
        <div className="rd-tab-strip" role="tablist" aria-label="Registration and Drops views">
          {(['charts', 'table'] as const).map(id => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`rd-tab${tab === id ? ' rd-tab--active' : ''}`}
              onClick={() => setTab(id)}
            >
              {id === 'charts' ? 'Charts' : 'Table'}
            </button>
          ))}
        </div>
      )}

      {/* Charts tab */}
      {!compact && tab === 'charts' && (
        <div role="tabpanel" className="rd-tab-panel">
          {chartsPanel}
        </div>
      )}

      {/* Table tab (or compact mode — always show table) */}
      {(compact || tab === 'table') && (
        <div role={compact ? undefined : 'tabpanel'} className={compact ? undefined : 'rd-tab-panel'}>
          {tablePanel}
        </div>
      )}

      {/* Coupon usage — always visible below the tab panel */}
      <CouponUsageCallout count={couponCount} percent={couponUsagePercent} />

      {/* Teams section */}
      {teams.hasTeams && (
        <>
          <SectionHeader title="Teams" level={3} />
          <div className="stat-cards-row">
            <StatCard label="Teams"               value={teams.totalTeams.toLocaleString()} />
            <StatCard label="Avg Team Size"        value={teams.avgTeamSize} />
            <StatCard label="Team Participants"    value={teams.teamParticipants.toLocaleString()} />
            <StatCard label="Solo Participants"    value={teams.soloParticipants.toLocaleString()} />
            {teams.teamAvgAge !== null && <StatCard label="Team Avg Age" value={teams.teamAvgAge} />}
            {teams.soloAvgAge !== null && <StatCard label="Solo Avg Age" value={teams.soloAvgAge} />}
          </div>
          {(teams.allMaleTeams > 0 || teams.allFemaleTeams > 0 || teams.mixedTeams > 0) && (
            <div className="chart-subsection">
              <h3 className="chart-subsection-title">Team Gender Composition</h3>
              <table className="stats-table stats-table--narrow">
                <caption className="sr-only">Team gender composition counts</caption>
                <thead>
                  <tr><th scope="col">Composition</th><th scope="col">Teams</th></tr>
                </thead>
                <tbody>
                  {teams.allFemaleTeams > 0 && <tr><td>All Female</td><td>{teams.allFemaleTeams}</td></tr>}
                  {teams.allMaleTeams > 0 && <tr><td>All Male</td><td>{teams.allMaleTeams}</td></tr>}
                  {teams.mixedTeams > 0 && <tr><td>Mixed Gender</td><td>{teams.mixedTeams}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
