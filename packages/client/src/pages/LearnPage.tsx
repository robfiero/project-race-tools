import { useState } from 'react';
import './LearnPage.css';

// ─── Content data ─────────────────────────────────────────────────────────────

interface GuideEntry {
  title: string;
  overview: string;
  ideas: string[];
}

interface GuideSection {
  id: string;
  heading: string;
  intro: string;
  entries: GuideEntry[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'participant',
    heading: 'Registration Analytics',
    intro:
      'Registration Analytics is drawn from your race registration export, which captures ' +
      'what happens before race day. It shows how registration builds over time, which ' +
      'events people choose, how drops, coupons, and waitlists behave, and where ' +
      'participants are coming from. These patterns can help you understand demand, ' +
      'timing, reach, and operational pressure before the race ever starts.',
    entries: [
      {
        title: 'Summary & Participation Overview',
        overview:
          'The summary gives you the headline numbers: total registrations, how many are ' +
          'actively participating, and how those registrations break down across your event ' +
          'distances or categories. This is the starting point for everything else — a ' +
          'single-number gut-check before you dig into demographics, geography, or trends. ' +
          'The gap between total registrations and active participants can be particularly ' +
          'telling: it captures people who registered but later dropped, were removed, or ' +
          'are otherwise no longer on the start list.',
        ideas: [
          'Is your overall registration count growing year over year? Flat or declining ' +
          'numbers may warrant a closer look at your marketing reach, race timing relative ' +
          'to competing events, or whether your entry price has drifted above what your ' +
          'market will bear.',
          'A large gap between registered and active participants — more than 8–10% — ' +
          'can suggest that your drop, removal, or transfer patterns deserve a closer ' +
          'look. It may also be normal for your race type, which makes prior-year ' +
          'comparison more useful than a broad industry average.',
          'If you offer multiple distances, the event breakdown shows which options are ' +
          'attracting the most participants. A distance that consistently fills fastest is ' +
          'often a candidate for a capacity increase; one that struggles to fill may not ' +
          'be earning its place on the schedule.',
        ],
      },
      {
        title: 'Gender Distribution',
        overview:
          'Gender statistics show the male, female, and non-binary breakdown of your ' +
          'participant base across all events. Endurance events vary significantly in their ' +
          'gender ratios — a local 5K often skews female while a 100-miler may skew heavily ' +
          'male — and understanding your race\'s ratio in context of its distance and ' +
          'community is the first step toward intentional decisions about inclusivity, ' +
          'marketing, and race experience design.',
        ideas: [
          'Is your female participation trending upward, flat, or declining over multiple ' +
          'years? Those trends can help you evaluate whether your outreach, imagery, ' +
          'race experience, and community relationships are reaching the field you intend ' +
          'to serve.',
          'A heavily skewed ratio — well below 30% female, for instance — may reflect ' +
          'the norms of your distance and discipline, or it may signal that your marketing ' +
          'imagery, race culture, or course difficulty is perceived as unwelcoming. Those ' +
          'are different possibilities, and the data can help you decide what deserves ' +
          'more direct review.',
          'Non-binary representation is small in most datasets but worth tracking. ' +
          'Whether you offer a non-binary division, display inclusive language on your ' +
          'registration form, and provide appropriate facilities are details that runners ' +
          'notice and share.',
        ],
      },
      {
        title: 'Age Distribution',
        overview:
          'Age statistics show the spread of participant ages — the median, the range, ' +
          'and how participation breaks down across age groups. Age demographics affect ' +
          'medical planning, marketing channels, course design considerations, and even ' +
          'sponsorship opportunities. A race whose median age is rising year over year ' +
          'may indicate that your participant base is changing, which is worth reviewing ' +
          'alongside your event distances, pricing, and outreach.',
        ideas: [
          'Is your median age creeping upward with each passing year? This is common in ' +
          'trail ultramarathons and can indicate difficulty attracting newer or younger ' +
          'runners. It\'s worth asking whether your entry-level distance, your marketing ' +
          'channels, and your race atmosphere are accessible to people just entering ' +
          'endurance sports.',
          'A race with a very wide age spread — participants ranging from their 20s into ' +
          'their 60s — often signals a strong community feel and welcoming culture. That ' +
          'diversity is worth celebrating and preserving intentionally as the race grows.',
          'Age group data can help you evaluate whether your divisions and awards structure ' +
          'reflects your actual field. If your 50–59 age group is larger than your 30–39 ' +
          'group, your awards depth in older divisions may deserve a second look.',
        ],
      },
      {
        title: 'Geographic Reach',
        overview:
          'Geographic statistics show where your participants are traveling from — which ' +
          'states (and countries) are most represented, and the average distance each ' +
          'participant travels to reach your start line. This data defines whether you are ' +
          'a local community race, a regional draw, or a destination event — and that ' +
          'distinction shapes almost every logistical and marketing decision you make.',
        ideas: [
          'If most participants are within a 2–3 hour drive, you\'re operating primarily ' +
          'as a regional race. That\'s not a weakness — many beloved races are deeply ' +
          'regional — but it may mean that local and regional outreach matters more than ' +
          'national marketing.',
          'A significant draw from distant states or other countries signals that your ' +
          'race is reaching beyond its immediate market. Lodging partnerships, travel ' +
          'guides, and group hotel blocks may improve the experience for participants ' +
          'who are planning from farther away.',
          'Year-over-year shifts in your geographic distribution can be revealing: a ' +
          'sudden increase in out-of-state participants may be worth comparing against ' +
          'recent marketing, partnerships, media coverage, or calendar changes. Pairing ' +
          'the data with that context can help you understand what may have contributed.',
        ],
      },
      {
        title: 'Registration Timing',
        overview:
          'Registration timing charts show when participants are signing up — by hour of ' +
          'the day, day of the week, and how registrations accumulate across the entire ' +
          'registration window. This can help you spot when registration activity is ' +
          'strongest and gives you a factual basis for timing marketing pushes, early-bird ' +
          'deadlines, and reminder campaigns.',
        ideas: [
          'If registrations spike heavily in the final two to three weeks before your ' +
          'cutoff, a structured early-bird pricing tier could shift some of that demand ' +
          'earlier — giving you better planning data and more predictable cash flow. ' +
          'Conversely, if your race fills in the first few days, a tiered pricing model ' +
          'may already be working in your favor without you realizing it.',
          'Evening and weekend registration peaks tell you that your audience is signing ' +
          'up outside normal workday hours. That can inform when promotional emails and ' +
          'social posts are most likely to be seen and acted on.',
          'A registration curve that plateaus early and then barely moves until a ' +
          'late-window surge may indicate that your race has a loyal core audience, while ' +
          'also showing where mid-window visibility could help. A referral incentive or club partnership ' +
          'can be one way to test whether additional outreach helps fill the lull.',
        ],
      },
      {
        title: 'Coupon & Discount Usage',
        overview:
          'Coupon statistics show how many participants used a discount code and the ' +
          'aggregate revenue impact of those discounts. Discount codes are a common and ' +
          'useful tool, but without visibility into how they\'re actually being used, ' +
          'it can be hard to tell whether they are supporting registration goals or ' +
          'mainly reducing per-participant revenue.',
        ideas: [
          'Are discount codes going primarily to runners who would have signed up anyway? ' +
          'If your codes are widely shared on social media rather than targeted at ' +
          'specific clubs or first-time participants, you may be reducing revenue from ' +
          'existing demand rather than creating measurable new reach.',
          'High coupon uptake — more than 10–15% of participants using a code — combined ' +
          'with strong overall registration suggests price sensitivity in your audience. ' +
          'That\'s useful information: it may mean a modest price reduction could ' +
          'increase volume more than it costs in per-participant revenue.',
          'Tracking coupon usage year over year helps you evaluate specific campaigns. ' +
          'If a club partnership code was used by 40 runners last year, that\'s a concrete ' +
          'number to anchor next year\'s conversation with that club.',
        ],
      },
      {
        title: 'Comped Entries',
        overview:
          'Comped entries are registrations where the fee was fully waived — typically ' +
          'for volunteers, race staff, sponsors, elite athletes, or pacers. Comps are ' +
          'a real and legitimate cost of running a quality event, but they\'re also one ' +
          'of the least-visible line items in most race directors\' financial picture. ' +
          'Tracking them explicitly makes that cost visible and intentional.',
        ideas: [
          'Are comped entries concentrated in your longer, more expensive distances? ' +
          'That may be entirely appropriate — your 100-mile volunteers deserve recognition ' +
          '— but it\'s worth confirming that the comping policy reflects your actual ' +
          'operational needs rather than accumulated tradition.',
          'Comparing comp counts across years can reveal scope creep: a comp list that ' +
          'grows by 15% each year without a corresponding increase in volunteers or ' +
          'event complexity may warrant a policy review.',
          'Some races formalize comps into explicit volunteer benefit tiers — e.g., ' +
          '"work one aid station, get half off; work two, get a free entry." Visibility ' +
          'into your current comp volume gives you a baseline to design that kind of ' +
          'structured program.',
        ],
      },
      {
        title: 'Cross-Event Breakdown',
        overview:
          'For races offering multiple distances or categories, the cross-event breakdown ' +
          'compares participation numbers, growth rates, and demographics side by side ' +
          'across your event options. Each distance may attract a different mix of ' +
          'participants, and understanding those differences helps you allocate resources ' +
          'and make informed decisions about the race\'s lineup.',
        ideas: [
          'Is your flagship distance still your fastest-growing option, or has a shorter ' +
          'distance quietly started outpacing it? A shorter option that\'s growing rapidly ' +
          'may be an important entry point for participants who later consider your longer ' +
          'events.',
          'An event distance that consistently underperforms in registrations is worth ' +
          'evaluating honestly. Is it priced correctly relative to its distance? Does it ' +
          'serve a genuinely different audience, or does it largely duplicate another ' +
          'option? Adding a distance is easy; retiring one gracefully is harder and better ' +
          'done proactively than reactively.',
          'Cross-event demographics can reveal surprises: if your shorter distance skews ' +
          'significantly younger or more female than your longer options, those are ' +
          'participant groups you may want to support intentionally as part of your ' +
          'broader event lineup.',
        ],
      },
      {
        title: 'Team & Relay Participation',
        overview:
          'Team statistics show how many participants are entering as part of relay or ' +
          'team entries versus as individuals. Team entries can be a useful growth lever ' +
          'because one team captain or group organizer can bring multiple registrations ' +
          'into the same event.',
        ideas: [
          'Is your relay or team option underutilized relative to your total field size? ' +
          'A well-promoted team option can be particularly effective with corporate ' +
          'wellness programs, running clubs, and social running groups who want to ' +
          'participate together.',
          'Teams tend to create memorable shared experiences that generate the kind of ' +
          'photos and stories that spread organically on social media. If your team ' +
          'participation is growing, investing in team-specific finish-line moments — ' +
          'group photos, team awards — may make that part of the event more visible.',
          'If team participation is declining, it\'s worth asking whether the logistics ' +
          'are too complicated. Registration flows that require a team captain to manage ' +
          'multiple entries can create enough friction that some groups choose individual ' +
          'registration or skip the team option.',
        ],
      },
      {
        title: 'Pre-Race Attrition (Dropped Participants)',
        overview:
          'Pre-race attrition tracks participants who registered and then formally ' +
          'withdrew before race day — distinct from DNS (did not start), which happens ' +
          'on race day itself. Understanding when and how often this happens helps ' +
          'you review refund policies, manage waitlists, and separate documented drops ' +
          'from race-day outcomes that belong in Race Results.',
        ideas: [
          'A high drop rate in the weeks immediately before the race — rather than ' +
          'spread throughout the registration window — may suggest course difficulty ' +
          'concerns, logistics challenges, or life circumstances. A structured waitlist ' +
          'that activates when drops occur can help you backfill registrations and keep ' +
          'alternate runners engaged rather than disappointed.',
          'If drops are concentrated in a specific event or distance, that\'s a signal ' +
          'worth investigating. A course distance that sees 15% pre-race attrition when ' +
          'your others see 5% may point to pricing, schedule, cutoff, training-load, or ' +
          'communication issues worth reviewing.',
          'Pre-race drops that go unfilled can create revenue and capacity gaps. Tracking ' +
          'your typical drop rate gives you a better basis for refund, transfer, and ' +
          'waitlist policies that fit your race.',
        ],
      },
    ],
  },
  {
    id: 'results',
    heading: 'Race Results',
    intro:
      'Race Results reports are drawn from your timing or results export, which captures ' +
      'what happened on race day. They show who started, who finished, who did not start, ' +
      'who did not finish, and how outcomes and performance varied across events, years, ' +
      'gender, age, distance, and geography. When race date, time, and venue are supplied, ' +
      'weather context can help frame finish rates, pace or distance trends, and race-day conditions.',
    entries: [
      {
        title: 'Summary & Race Overview',
        overview:
          'The summary captures your headline race-day metrics: total starters, finishers, ' +
          'DNF count, DNS count, and the resulting finish rate. These numbers are the most ' +
          'visible and widely shared statistics about any endurance event — finish rate in ' +
          'particular carries significant weight in how the trail and ultra community ' +
          'perceives a race\'s difficulty and overall experience quality.',
        ideas: [
          'Is your finish rate consistent year over year, or does it swing significantly? ' +
          'Wide swings may line up with weather, course condition changes, or cutoff ' +
          'adjustments. Weather and race metadata can provide context, while unexplained ' +
          'swings are worth investigating.',
          'A consistently high DNF rate isn\'t automatically a problem. Some races cultivate ' +
          'a reputation for genuine difficulty, and runners who sign up understand the ' +
          'challenge. What matters is whether the rate is intentional and whether your ' +
          'medical and sweep infrastructure is appropriately sized for it.',
          'Separating DNS from DNF is important context that\'s easy to overlook. A high ' +
          'DNS rate — runners who appear in results data but never reached the start line ' +
          '— can suggest pre-race issues such as injury, illness, travel problems, or ' +
          'weather concerns. That is different from a runner who started and then stopped.',
        ],
      },
      {
        title: 'Race Dates & Weather',
        overview:
          'Race date and weather data provide the environmental context for every other ' +
          'metric in your results. A finish rate of 72% is a very different story on a ' +
          'clear 58°F September morning than on a 44°F rainy October night — yet without ' +
          'recording those conditions, you lose the context needed to interpret your own ' +
          'historical data. Weather snapshots are captured at race start, every six hours ' +
          'during the event, and at race close.',
        ideas: [
          'When comparing multiple years side by side, weather is often the single biggest ' +
          'variable. If your finish rate dropped sharply in one year and that year saw ' +
          'significantly warmer or wetter conditions, weather context can help frame the ' +
          'result for runners, volunteers, and stakeholders.',
          'Warmer-than-usual years with elevated DNF rates may suggest that your aid ' +
          'station hydration options, cooling resources, or heat protocols deserve a second ' +
          'look before the next edition. Data that shows a pattern over two or three years ' +
          'can be more useful for planning than a one-off incident report.',
          'For long races covering multiple weather snapshots — overnight 100-milers ' +
          'in particular — the progression from evening to overnight to morning conditions ' +
          'can add context around dropout clusters. A wave of DNFs at a 3 a.m. aid station ' +
          'may be worth reviewing alongside a visible temperature drop in the weather data.',
        ],
      },
      {
        title: 'Finish Time Performance',
        overview:
          'Finish time statistics describe the distribution of how long your race took ' +
          'finishers to complete — including the median (the middle of the field), the ' +
          'fastest and last finishers, and how times spread across gender groups. ' +
          'Finish time data is useful both for logistical planning — when does the bulk ' +
          'of your field cross the finish line? — and for understanding the competitive ' +
          'character of your event.',
        ideas: [
          'Is your median finish time drifting slower year over year? This often reflects ' +
          'a changing finisher field — for example, more runners completing the distance ' +
          'rather than racing it. It may also suggest changes in course conditions, trail ' +
          'maintenance, cutoffs, or weather.',
          'Knowing where most of your finishers land helps you staff the finish line ' +
          'appropriately. If 60% of your 50K finishers cross between hours 7 and 10, ' +
          'that\'s when you need your announcer, your finisher medals, your food, and ' +
          'your medical team at peak readiness.',
          'Time distributions by gender can help you review whether course demands, ' +
          'cutoffs, or race-day conditions appear to affect groups differently. Those ' +
          'patterns are most useful when interpreted in the context of your specific race.',
        ],
      },
      {
        title: 'DNF & Attrition Patterns',
        overview:
          'DNF (Did Not Finish) analysis breaks down who is dropping out of your race — ' +
          'by gender, event, and age group — and what rate they\'re doing so. Unlike ' +
          'pre-race attrition, DNFs happen on course and tell you about the race ' +
          'experience itself: the difficulty, the conditions, the support infrastructure, ' +
          'and whether certain groups of starters are disproportionately affected.',
        ideas: [
          'If your DNF rate is notably higher for one gender or age group, it\'s worth ' +
          'asking whether your aid station support, pacer policies, cutoff structure, or ' +
          'course marking may be creating unintentional barriers for that group. The data ' +
          'does not prove the cause, but it can help you decide what operational factors ' +
          'deserve review.',
          'In multi-event races, comparing DNF rates across distances reveals a lot about ' +
          'each event\'s character. An event where 30% of starters drop is not necessarily ' +
          'a failure — it may be precisely as difficult as you intended — but if it\'s ' +
          'unexpected, the data gives you a focused place to start reviewing.',
          'Year-over-year DNF rate trends are more informative than any single year\'s ' +
          'number. A rate that is gradually rising despite consistent weather and course ' +
          'conditions may suggest a field, cutoff, support, or preparation pattern worth ' +
          'reviewing before assuming the course itself is the issue.',
        ],
      },
      {
        title: 'Finisher Demographics (Gender & Age)',
        overview:
          'Finisher demographics show the gender and age breakdown specifically of the ' +
          'finishers who completed your race — not just those who started. Comparing ' +
          'finisher demographics to starter demographics can help you spot meaningful ' +
          'differences across groups: does a group that starts at 40% of your field finish ' +
          'at 40%, or does it finish at a meaningfully different rate?',
        ideas: [
          'A significant gap between a group\'s representation at the start versus at the ' +
          'finish is a signal worth investigating. If women represent 38% of starters but ' +
          'only 30% of finishers, cutoffs, course conditions, support structures, or other ' +
          'race-day factors may deserve review.',
          'Age group finisher data can help you spot where finish rates differ across ' +
          'age bands. Very high finish rates for older age groups may indicate experienced, ' +
          'well-prepared runners; very low rates in younger groups may point to preparation, ' +
          'pacing, cutoff, or course-fit questions.',
          'Finisher age data can also inform your awards structure. If your masters ' +
          'divisions (50+, 60+) consistently produce large, competitive fields, robust ' +
          'age-group recognition in those brackets may mean more to your community than ' +
          'the overall top-three podium.',
        ],
      },
      {
        title: 'Geographic Reach of Finishers',
        overview:
          'Geographic data for finishers shows where finishers traveled ' +
          'from — which states are most represented, and how far people came to cross your ' +
          'finish line. Finisher geography can help you review whether results vary by ' +
          'region and whether your race\'s reach extends beyond its immediate area.',
        ideas: [
          'If starters who travel long distances show notably different finish rates ' +
          'than local runners, familiarity with the terrain, climate, or race-day logistics ' +
          'may be a factor. Out-of-region runners who can\'t preview the course or ' +
          'acclimatize to your local conditions may benefit from better pre-race ' +
          'course information and more detailed aid station guidance.',
          'Strong out-of-state finisher representation suggests your race is drawing ' +
          'beyond its local market, which can be useful context for partnership conversations ' +
          'with gear companies, local tourism boards, and running publications.',
          'Geographic data can also surface recurring regional patterns. If the same states ' +
          'appear year after year in your top-10 finisher list, those communities may be ' +
          'candidates for targeted outreach, club partnerships, or packet-pickup planning.',
        ],
      },
      {
        title: 'Cross-Event Performance Comparison',
        overview:
          'In multi-distance races, the cross-event comparison puts your different event ' +
          'offerings side by side: finish rates, median times, demographic makeup, course ' +
          'records, and last finisher times. Each distance can attract a different field ' +
          'and challenge starters in different ways. Understanding how each event performs ' +
          'relative to the others is essential for resource allocation and race design.',
        ideas: [
          'Is one distance consistently outperforming the others in finish rate? That ' +
          'event may be operating in a well-calibrated difficulty window for your course ' +
          'and typical conditions, making it worth reviewing as a reference point when ' +
          'designing or adjusting other distances.',
          'Course record data tells you something about the competitiveness of your field ' +
          'over time. A course record that hasn\'t been threatened in several years may ' +
          'suggest changes in field depth, course conditions, or race-day conditions. It ' +
          'may also simply mean the record was set in an exceptional year.',
          'Last finisher data is often overlooked but carries genuine meaning. A last ' +
          'finisher who crosses well within the cutoff time suggests healthy capacity; ' +
          'one who barely makes it suggests your cutoff may be the limiting factor for ' +
          'a portion of your field, and is worth reviewing before changing the course or ' +
          'support plan.',
        ],
      },
      {
        title: 'Year-over-Year Trends',
        overview:
          'Multi-year comparison brings everything together across time — total entrants, ' +
          'finish rates, finisher demographics, and median performance — so you can see ' +
          'trajectory rather than just snapshots. Any single year\'s data tells you what ' +
          'happened once. Multi-year data helps you spot patterns worth planning around.',
        ideas: [
          'A downward trend in total entrants warrants honest examination of what changed. ' +
          'Pricing, course modifications, competition from newer events, or broader market ' +
          'saturation in your distance category are all worth considering — and they have ' +
          'different operational responses. Trending data gives you a timeline to compare ' +
          'against known changes.',
          'An upward trend in finish rate following a course adjustment or infrastructure ' +
          'investment may suggest that the change helped. Multi-year data can support ' +
          'better conversations with stakeholders, sponsors, or co-directors, especially ' +
          'when paired with operational context.',
          'Trends that don\'t match your intuition are often the most valuable. If you ' +
          'believe your race is growing but the data shows stagnation, or if you think ' +
          'your finish rate is declining when it\'s actually stable, the data is giving ' +
          'you a useful check against anecdote. That correction is exactly what analytics ' +
          'is for.',
        ],
      },
    ],
  },
];

// ─── Accordion component ──────────────────────────────────────────────────────

function AccordionItem({ entry, defaultOpen = false }: { entry: GuideEntry; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`guide-item${open ? ' guide-item--open' : ''}`}>
      <button
        type="button"
        className="guide-item-trigger"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="guide-item-title">{entry.title}</span>
        <span className="guide-item-chevron" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="guide-item-body">
          <p className="guide-item-overview">{entry.overview}</p>
          <div className="guide-item-ideas">
            <span className="guide-item-ideas-label">What could this mean?</span>
            <ul>
              {entry.ideas.map((idea, i) => (
                <li key={i}>{idea}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LearnPage() {
  return (
    <div className="learn-page">

      {/* ── Intro ── */}
      <section className="learn-hero">
        <img
          className="learn-hero-image"
          src="/analytics-guide-hero.svg"
          alt="Illustrated banner representing analytics guidance and data exploration"
        />
        <h1 className="learn-hero-title">Learn Analytical Impacts</h1>
        <blockquote className="learn-hero-tagline">
          The goal isn't to turn race directors into analysts.<br />
          It's to surface the analytics and let them tell you their story.
        </blockquote>
        <div className="learn-hero-body">
          <p>
            Your registration and timing platforms already collect useful race data.
            RaceOps turns those CSV exports into a clearer story about registration
            timing, participant mix, travel patterns, finish outcomes, pace or distance
            trends, and race-day conditions.
          </p>
          <p>
            The goal is not to make race directors become data scientists. RaceOps
            surfaces the patterns that are already there, so you can understand what
            changed, what held steady, and where your race may need attention next.
          </p>
        </div>
      </section>

      {/* ── Guide sections ── */}
      {GUIDE_SECTIONS.map(section => (
        <section key={section.id} className="learn-section">
          <h2 className="learn-section-heading">{section.heading}</h2>
          <p className="learn-section-intro">{section.intro}</p>
          <div className="learn-accordion">
            {section.entries.map((entry, i) => (
              <AccordionItem key={entry.title} entry={entry} defaultOpen={i === 0} />
            ))}
          </div>
        </section>
      ))}

    </div>
  );
}
