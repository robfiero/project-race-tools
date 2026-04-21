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
                View GitHub repository<span className="sr-only"> (opens in new tab)</span> →
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
          RaceOps is a data analytics platform for race directors. It analyzes exported race
          registration data and turns it into actionable insights — participant demographics,
          geographic reach, registration timing, participation trends, and year-over-year growth
          — without storing personally identifiable information.
        </p>
        <p>
          The project was built from a race director's perspective: practical, privacy-conscious,
          and focused on the questions that come up when planning, improving, and communicating
          about an event.
        </p>
        <p>
          RaceOps is intentionally designed as a production-style system rather than a prototype.
          It uses a privacy-first import pipeline, session-scoped analysis, clear visualizations,
          and plain-language summaries so race directors can understand their data without needing
          to become analysts.
        </p>
      </div>

      <div className="about-grid">
        <div className="about-section card">
          <h2>Why I built it</h2>
          <p className="about-section-subtitle">A real problem in a niche I know well.</p>
          <ul>
            <li>As a race director, I wanted a clearer way to understand the data my races already generate: who signs up, where participants come from, when registrations happen, how distances compare, and how those patterns change year over year.</li>
            <li>Registration platforms do a lot of the heavy lifting for race operations. RaceOps explores a complementary layer: what can race directors learn from the exported data they already have?</li>
            <li>Privacy was a core requirement from the start. The goal was to make the analysis useful without retaining names, emails, addresses, phone numbers, or other personally identifiable participant details.</li>
          </ul>
        </div>

        <div className="about-section card">
          <h2>Key goals</h2>
          <p className="about-section-subtitle">Principles that shaped the design.</p>
          <ul>
            <li>Personal information in uploaded files is never read or analyzed — PII columns are structurally excluded at parse time, not discarded after the fact.</li>
            <li>Make complex race statistics accessible through clear visualizations and plain-language labels.</li>
            <li>Support year-over-year comparison so race directors can track growth, spot trends, and compare race editions.</li>
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
              <li><strong>Vite 6</strong> — fast development builds with HMR and API proxy</li>
              <li><strong>Recharts</strong> — composable charting with theme-aware color palettes</li>
              <li>Discriminated union types for type-safe session state across upload, single-year, and comparison modes</li>
              <li>Theme system with holiday variants and WCAG-compliant contrast across all palette options</li>
            </ul>
          </div>
          <div className="about-tech-col">
            <h3>Backend</h3>
            <ul>
              <li><strong>Node.js + Express + TypeScript</strong> — REST API with adapter-based file parsing</li>
              <li><strong>Adapter pattern</strong> — each registration platform (UltraSignup, more planned) implements a single detect/transform interface</li>
              <li><strong>In-memory sessions</strong> — no database; parsed data lives only for the duration of the browser session</li>
              <li><strong>CSV and Excel</strong> — file parsing via PapaParse and SheetJS; personal data columns are identified and excluded at parse time</li>
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
        <p className="about-section-subtitle">This project used AI tools at different stages of development, while architecture, product direction, and engineering judgment remained hands-on.</p>
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
          for the current development phase. The workflow included exploring large parts of the codebase
          with natural language queries, iterating on multi-file features in a single session, refining
          data models, and reviewing architectural tradeoffs.
        </p>
        <p>
          All AI-assisted code was reviewed, tested, and held to the same standard as hand-written
          code. The goal was to use AI as a force multiplier for iteration, not as a substitute for
          engineering judgment.
        </p>
      </div>

      <div className="about-grid">
        <div className="about-section card">
          <h2>What I learned</h2>
          <p className="about-section-subtitle">The polish comes from small, repeatable decisions.</p>
          <ul>
            <li>Designing privacy constraints up front is much easier than retrofitting them — the adapter pattern made personal data exclusion structural rather than optional.</li>
            <li>Multi-year comparison requires careful sorting and normalization; race names and event names vary across years in ways that need explicit handling.</li>
            <li>Synthetic sample data generation is harder to make realistic than it looks — distribution shapes matter as much as value ranges.</li>
            <li>Session-based in-memory storage is sufficient for a single-user tool but requires thoughtful lifetime management to avoid stale data.</li>
          </ul>
        </div>

        <div className="about-section card">
          <h2>Why this project matters</h2>
          <p className="about-section-subtitle">A practical demo of product thinking, privacy-aware architecture, and end-to-end engineering execution.</p>
          <ul>
            <li>Demonstrates full-stack ownership across import workflows, API design, session management, analytics, visualization, and deployment.</li>
            <li>Privacy-first architecture that treats constraints as design requirements, not afterthoughts.</li>
            <li>Built to be demo-friendly without sacrificing production-quality structure — real parsing, real analytics, real deployment.</li>
            <li>Complements registration platforms by adding analysis and reporting around exported data.</li>
            <li>Active project evolving through incremental releases, with race results and financials analysis planned.</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
