import './AboutPage.css';

export default function AboutPage() {
  return (
    <div className="about-page">

      <div className="about-header card">
        <h1 className="about-title">About RaceOps</h1>
        <div className="about-creator">
          <img
            src="/rob-fiero.jpg"
            alt="Robert Fiero"
            className="about-creator-photo"
          />
          <div className="about-creator-info">
            <strong>Created by Robert Fiero</strong>
            <div className="about-links">
              <a
                href="https://www.linkedin.com/in/robert-fiero/"
                target="_blank"
                rel="noopener noreferrer"
                className="about-link"
              >
                View LinkedIn profile<span className="sr-only"> (opens in new tab)</span> →
              </a>
              <a
                href="https://github.com/robfiero/"
                target="_blank"
                rel="noopener noreferrer"
                className="about-link"
              >
                View GitHub profile<span className="sr-only"> (opens in new tab)</span> →
              </a>
              <a
                href="https://www.robfiero.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="about-link"
              >
                View portfolio website<span className="sr-only"> (opens in new tab)</span> →
              </a>
            </div>
          </div>
        </div>

        <p>
          RaceOps helps race directors turn exported data into summarized and detailed reports
          without storing personally identifiable information.
        </p>
        <ul>
          <li>Registration Analytics focuses on pre-race data: registration timing, drops, waitlists, coupons, demographics, geography, and travel distance.</li>
          <li>Race Results focuses on race-day data: starters, finishers, DNS/DNF outcomes, finish times, pace or distance trends, and weather context where supplied.</li>
        </ul>
        <p>
          The reports are designed to make race data easier to review, compare, and explain
          without requiring race directors to sort through raw exports by hand.
        </p>
      </div>

      <div className="about-grid">
        <div className="about-section card">
          <h2>Why I built it</h2>
          <p className="about-section-subtitle">A real problem in a niche I know well.</p>
          <ul>
            <li>As a race director, I wanted a clearer way to understand the data my races already generate: registration patterns before race day and results patterns after the event.</li>
            <li>Registration and timing platforms handle core operations. RaceOps adds a complementary reporting layer around the exported CSV data race directors already have.</li>
            <li>Privacy was a core requirement from the start. The goal was to make the analysis useful without retaining names, emails, addresses, phone numbers, or other personally identifiable participant details.</li>
          </ul>
        </div>

        <div className="about-section card">
          <h2>Key goals</h2>
          <p className="about-section-subtitle">Principles that shaped the design.</p>
          <ul>
            <li>Personal information in uploaded files is never read or analyzed — PII columns are structurally excluded at parse time, not discarded after the fact.</li>
            <li>Make complex race statistics accessible through clear visualizations and plain-language labels.</li>
            <li>Support year-over-year comparison so race directors can review growth, trends, and race editions over time.</li>
            <li>Build the system incrementally so additional registration platforms, result formats, and analysis modules can be added over time.</li>
          </ul>
        </div>
      </div>

      <div className="about-section card">
        <h2>Technical overview</h2>
        <p className="about-section-subtitle">A full-stack TypeScript system with a privacy-first data pipeline.</p>
        <div className="about-tech-grid">
          <div className="about-tech-col">
            <h3>Frontend</h3>
            <ul>
              <li><strong>React 18 + TypeScript</strong> — hooks-based state management with no external state library</li>
              <li><strong>Vite 5</strong> — fast development builds with HMR and API proxy</li>
              <li><strong>Recharts</strong> — composable charting with theme-aware color palettes</li>
              <li>Discriminated union types for type-safe session state across upload, single-year, and comparison modes</li>
              <li>Theme system with holiday variants and WCAG-compliant contrast across all palette options</li>
            </ul>
          </div>
          <div className="about-tech-col">
            <h3>Backend</h3>
            <ul>
              <li><strong>Node.js + Express + TypeScript</strong> — REST API with adapter-based file parsing</li>
              <li><strong>Adapter pattern</strong> — each supported export source (UltraSignup, more planned) implements a detect/transform interface</li>
              <li><strong>In-memory sessions</strong> — no database; parsed data lives only for the duration of the browser session</li>
              <li><strong>CSV uploads</strong> — file parsing via PapaParse; Excel exports should be saved as CSV before upload</li>
              <li><strong>ZIP centroid geocoding</strong> — distance-from-venue statistics without storing participant addresses</li>
            </ul>
          </div>
          <div className="about-tech-col">
            <h3>Infrastructure</h3>
            <ul>
              <li><strong>AWS App Runner</strong> — containerized backend with auto-scaling</li>
              <li><strong>AWS CloudFront + S3</strong> — CDN-delivered React frontend</li>
              <li><strong>GitHub Actions</strong> — CI/CD pipeline for frontend and backend deployments</li>
              <li>Environment-aware build with <code>VITE_API_BASE_URL</code> for production/development split</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="about-section card">
        <h2>AI-assisted engineering workflow</h2>
        <p className="about-section-subtitle">AI tools supported iteration, while architecture, product direction, and engineering judgment stayed hands-on.</p>
        <p>
          <strong>ChatGPT</strong> was used for early ideation — exploring implementation approaches
          and architecture tradeoffs before committing to a direction.
        </p>
        <p>
          <strong>GitHub Copilot</strong> was used for inline code completion during active development,
          particularly for repetitive patterns like adapter transforms and stat computation.
        </p>
        <p>
          <strong>Claude Code</strong> (Anthropic's CLI agent) became the primary AI engineering partner
          for the current development phase, supporting codebase exploration, multi-file iteration,
          data model refinement, and architectural review.
        </p>
        <p>
          All AI-assisted code was reviewed, tested, and held to the same standard as hand-written
          code. The goal was to use AI as a force multiplier for iteration, not as a substitute for
          engineering judgment.
        </p>
      </div>

      <div className="about-section card">
        <h2>Architecture Summary</h2>
        <img
          className="about-architecture-diagram"
          src="/raceops_architecture_summary.svg"
          alt="Diagram showing RaceOps CSV exports flowing through frontend workflow, backend analysis pipeline, and report presentation layers."
        />
        <p>
          RaceOps is organized around two upload workflows: Registration Analytics and Race
          Results. Each workflow accepts a source CSV, sends it through the appropriate analysis
          pipeline, and returns aggregate report data for the browser to display.
        </p>
        <p>
          The backend handles file parsing, validation, normalization, summary generation, and
          optional geography or weather enrichment. The frontend manages upload state, report
          configuration, charts, tables, and print-friendly presentation. Uploaded race data is
          not written to a database, and personal information is excluded from the reporting
          pipeline.
        </p>
      </div>

    </div>
  );
}
