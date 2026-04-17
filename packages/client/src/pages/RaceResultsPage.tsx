import './PlaceholderPage.css';

export default function RaceResultsPage() {
  return (
    <div className="placeholder-page">
      <div className="placeholder-card card">
        <div className="placeholder-icon" aria-hidden="true">📊</div>
        <h1 className="placeholder-title">Race Result Analytics</h1>
        <p className="placeholder-desc">
          This tool will analyze race results files to show finish times, DNF rates, pace
          distributions, age-group breakdowns, and performance trends — for a single year
          or across multiple editions of the same race.
        </p>
        <p className="placeholder-status">Coming soon</p>
        <p className="placeholder-hint">
          Supported formats will include UltraSignup results exports and standard timing
          system files. Multiple years can be loaded for year-over-year comparison.
        </p>
      </div>
    </div>
  );
}
