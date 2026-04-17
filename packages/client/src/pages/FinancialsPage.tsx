import './PlaceholderPage.css';

export default function FinancialsPage() {
  return (
    <div className="placeholder-page">
      <div className="placeholder-card card">
        <div className="placeholder-icon" aria-hidden="true">💰</div>
        <h1 className="placeholder-title">Financials Reconciliation</h1>
        <p className="placeholder-desc">
          This tool will cross-reference a registration participant list against financial
          statements for a single race year — reconciling participant counts, registration
          fees, platform fees, discounts, comped entries, and refunds.
        </p>
        <p className="placeholder-status">Coming soon</p>
        <p className="placeholder-hint">
          Upload a participant export alongside your financial statement to identify
          discrepancies and produce a reconciliation summary.
        </p>
      </div>
    </div>
  );
}
