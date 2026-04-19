import './AboutPage.css';

export default function AboutPage() {
  return (
    <div className="about-page">

      <div className="about-header card">
        <h1 className="about-title">About RaceStats</h1>
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
          RaceStats is a data analytics platform built for trail and ultramarathon race directors.
          It transforms participant registration exports from platforms like UltraSignup into
          actionable insights — registrant demographics, geographic reach, registration timing,
          and year-over-year trends — without ever storing personally identifiable information.
        </p>
        <p>
          The goal is to give race directors real visibility into their events: who is signing up,
          where they are coming from, when they register, and how the race is growing over time.
          All personal information is stripped immediately on upload and never written to disk.
        </p>
        <p>
          This project is intentionally built as a production-style system rather than a
          prototype, emphasizing privacy-first design, clean data pipelines, and an interface
          that race directors can use intuitively.
        </p>
      </div>

      <div className="about-grid">
        <div className="about-section card">
          <h2>Why I built it</h2>
          <p className="about-section-subtitle">A real problem in a niche I know well.</p>
          <ul>
            <li>As a race director, I thought it would be interesting to have greater insight into the large volume of data about my races, so I've built a tool that can help do just that.</li>
            <li>Registration platforms often provide basic analytics — not the deeper analytics that can be discovered in the raw data.</li>
            <li>Privacy was a core requirement from the start: participants' personal information should never leave the race director's hands in identifiable form.</li>
          </ul>
        </div>

        <div className="about-section card">
          <h2>Key goals</h2>
          <p className="about-section-subtitle">Principles that shaped the design.</p>
          <ul>
            <li>Strip personal information at the boundary — names, emails, addresses, and phone numbers are discarded on upload.</li>
            <li>Make complex statistics accessible through clear visualizations and plain-language labels.</li>
            <li>Support multi-year comparison so directors can track growth and spot trends across race editions.</li>
            <li>Build a system that can grow incrementally.</li>
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
        <p className="about-section-subtitle">Three tools, applied at different stages of development.</p>
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
          Architecture decisions, product direction, and engineering judgment remained intentional and
          hands-on throughout. All AI-assisted code was reviewed and held to the same standard as
          human-written code. One goal of this project is to demonstrate how engineers can use AI tools
          responsibly — as a force multiplier for iteration, not a substitute for judgment.
        </p>
      </div>

      <div className="about-grid">
        <div className="about-section card">
          <h2>What I learned</h2>
          <p className="about-section-subtitle">The polish comes from small, repeatable decisions.</p>
          <ul>
            <li>Designing privacy constraints upfront is much easier than retrofitting them — the adapter pattern made personal data exclusion structural rather than optional.</li>
            <li>Multi-year comparison requires careful sorting and normalization; race names and event names vary across years in ways that need explicit handling.</li>
            <li>Synthetic sample data generation is harder to make realistic than it looks — distribution shapes matter as much as value ranges.</li>
            <li>Session-based in-memory storage is sufficient for a single-user tool but requires thoughtful lifetime management to avoid stale data.</li>
          </ul>
        </div>

        <div className="about-section card">
          <h2>Why this project matters</h2>
          <p className="about-section-subtitle">A credible demo of end-to-end engineering judgment.</p>
          <ul>
            <li>Demonstrates full-stack ownership across data ingestion, API design, session management, and UI delivery.</li>
            <li>Privacy-first architecture that treats constraints as design requirements, not afterthoughts.</li>
            <li>Built to be demo-friendly without sacrificing production-quality structure — real parsing, real stats, real deployment.</li>
            <li>Active project evolving through incremental releases, with race results and financials analysis planned.</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
