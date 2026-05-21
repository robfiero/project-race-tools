import { useState } from 'react';
import type { ReactNode } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import type { GeographicStats } from '../types.ts';
import SectionHeader from './SectionHeader.tsx';
import StatCard from './StatCard.tsx';
import InsightCallout from './InsightCallout.tsx';
import { useTheme } from '../ThemeContext.tsx';
import { geographicInsights } from '../insights.ts';
import './ChartSection.css';

type GeoTab = 'chart' | 'table' | 'countries';

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
]);

const CA_PROVINCE_CODES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
]);

const MX_STATE_CODES = new Set([
  'AGU', 'BCN', 'BCS', 'CAM', 'CHP', 'CHH', 'CMX', 'COA', 'COL', 'DUR',
  'GUA', 'GRO', 'HID', 'JAL', 'MEX', 'MIC', 'MOR', 'NAY', 'NLE', 'OAX',
  'PUE', 'QUE', 'ROO', 'SLP', 'SIN', 'SON', 'TAB', 'TAM', 'TLA', 'VER',
  'YUC', 'ZAC',
]);

function countryLabelForStateProvince(state: string): string {
  const normalized = state.trim().toUpperCase();
  if (US_STATE_CODES.has(normalized)) return 'US';
  if (CA_PROVINCE_CODES.has(normalized)) return 'Canada';
  if (MX_STATE_CODES.has(normalized)) return 'Mexico';
  return 'Unknown';
}

interface Props {
  stats: GeographicStats;
  title?: string;
  showUnknownLocation?: boolean;
  basisNote?: string;
  contextNote?: ReactNode;
  contextStrip?: ReactNode;
  insightsPosition?: 'top' | 'bottom';
  summaryMode?: 'default' | 'race-results';
  stateChartBarColor?: string;
}

export default function GeographicSection({
  stats,
  title = 'Geography',
  showUnknownLocation = false,
  basisNote,
  contextNote,
  contextStrip,
  insightsPosition = 'top',
  summaryMode = 'default',
  stateChartBarColor,
}: Props) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<GeoTab>('chart');

  const topStates    = stats.topStates.slice(0, 15);
  const topCountries = stats.topCountries.slice(0, 10);
  const insights     = geographicInsights(stats);
  const unknownLocationParticipants = stats.unknownLocationParticipants ?? 0;
  const total        = stats.usParticipants + stats.internationalParticipants + (showUnknownLocation ? unknownLocationParticipants : 0);
  const usStateCount = Object.keys(stats.byState).filter(state => US_STATE_CODES.has(state.toUpperCase())).length;
  const nonUsStateProvinceCount = Object.keys(stats.byState).filter(state => !US_STATE_CODES.has(state.toUpperCase())).length;
  const stateProvinceCount = Object.keys(stats.byState).length;
  const countryCount = Object.keys(stats.byCountry).length;
  const isRaceResultsSummary = summaryMode === 'race-results';

  return (
    <section className="chart-section">
      <SectionHeader title={title} contextStrip={contextStrip} />
      {contextNote}
      {basisNote && <p className="chart-section-note">{basisNote}</p>}

      <div className="stat-cards-row">
        <StatCard label="US Participants"    value={stats.usParticipants.toLocaleString()} />
        {isRaceResultsSummary && <StatCard label="US States" value={usStateCount} />}
        <StatCard label={isRaceResultsSummary ? 'International Participants' : 'International'} value={stats.internationalParticipants.toLocaleString()} />
        {!isRaceResultsSummary && showUnknownLocation && (
          <StatCard label="Unknown Location" value={unknownLocationParticipants.toLocaleString()} />
        )}
        {isRaceResultsSummary && <StatCard label="Total Countries" value={countryCount} />}
        <StatCard
          label={isRaceResultsSummary ? 'Non-US States / Provinces' : 'States / Provinces'}
          value={isRaceResultsSummary ? nonUsStateProvinceCount : stateProvinceCount}
        />
        {!isRaceResultsSummary && <StatCard label="Countries" value={countryCount} />}
      </div>
      {isRaceResultsSummary && showUnknownLocation && unknownLocationParticipants > 0 && (
        <p className="chart-section-note geo-unknown-note">
          {unknownLocationParticipants.toLocaleString()} participant{unknownLocationParticipants === 1 ? '' : 's'} had unknown or unclassified location data.
        </p>
      )}

      {insightsPosition === 'top' && <InsightCallout insights={insights} />}

      <div className="rd-tab-strip" role="tablist" aria-label="Geography views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'chart'}
          className={`rd-tab${tab === 'chart' ? ' rd-tab--active' : ''}`}
          onClick={() => setTab('chart')}
        >
          State / Province Chart
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'table'}
          className={`rd-tab${tab === 'table' ? ' rd-tab--active' : ''}`}
          onClick={() => setTab('table')}
        >
          State / Province Table
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'countries'}
          className={`rd-tab${tab === 'countries' ? ' rd-tab--active' : ''}`}
          onClick={() => setTab('countries')}
        >
          Countries
        </button>
      </div>

      {tab === 'chart' && (
        <div role="tabpanel" className="rd-tab-panel">
          {topStates.length === 0 ? (
            <p className="rd-empty-group">No state/province data available.</p>
          ) : (
            <div className="chart-wrap chart-wrap--full" aria-hidden="true">
              <ResponsiveContainer width="100%" height={Math.max(240, topStates.length * 30)}>
                <BarChart
                  data={topStates}
                  layout="vertical"
                  margin={{ top: 4, right: 64, bottom: 4, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="state" interval={0} tick={{ fontSize: 11 }} width={96} />
                  <Tooltip formatter={(v: number) => [v, 'Participants']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Participants" fill={stateChartBarColor ?? theme.chart[0]}>
                    <LabelList
                      dataKey="count"
                      position="right"
                      formatter={(v: unknown) => typeof v === 'number' ? v.toLocaleString() : ''}
                      style={{ fontSize: 11, fill: '#555' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {tab === 'table' && (
        <div role="tabpanel" className="rd-tab-panel">
          {topStates.length === 0 ? (
            <p className="rd-empty-group">No state/province data available.</p>
          ) : (
            <table className="stats-table">
              <caption className="sr-only">Top states and provinces by participant count</caption>
              <thead>
                <tr>
                  <th scope="col">State / Province</th>
                  {isRaceResultsSummary && <th scope="col">Country</th>}
                  <th scope="col">Count</th>
                  <th scope="col">%</th>
                </tr>
              </thead>
              <tbody>
                {topStates.map(row => (
                  <tr key={row.state}>
                    <td>{row.state}</td>
                    {isRaceResultsSummary && <td>{countryLabelForStateProvince(row.state)}</td>}
                    <td>{row.count.toLocaleString()}</td>
                    <td>{((row.count / total) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'countries' && (
        <div role="tabpanel" className="rd-tab-panel">
          <p className="chart-note">Country-level participant breakdown.</p>
          {topCountries.length <= 1 ? (
            <p className="rd-empty-group">No country data available.</p>
          ) : (
            <table className="stats-table stats-table--narrow">
              <caption className="sr-only">Participants by country</caption>
              <thead>
                <tr>
                  <th scope="col">Country</th>
                  <th scope="col">Count</th>
                </tr>
              </thead>
              <tbody>
                {topCountries.map(row => (
                  <tr key={row.country}>
                    <td>{row.country}</td>
                    <td>{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {insightsPosition === 'bottom' && <InsightCallout insights={insights} />}
    </section>
  );
}
