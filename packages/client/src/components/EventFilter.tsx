import './EventFilter.css';

interface Props {
  events: string[];
  selected: string[];  // empty = all, otherwise first value is the selected event
  onChange: (selected: string[]) => void;
}

// Returns approximate miles for a race label, or Infinity for unknown labels.
// Check half-marathon before marathon so "Half Marathon" doesn't also match /\bmarathon\b/.
function distanceMiles(name: string): number {
  const lower = name.toLowerCase();
  if (/\bhalf[\s-]marathon\b/.test(lower)) return 13.1;
  if (/\bmarathon\b/.test(lower)) return 26.2;
  const km = name.match(/(\d+(?:\.\d+)?)\s*k(?:m\b|\b)/i);
  if (km) return parseFloat(km[1]) * 0.621371;
  const mi = name.match(/(\d+(?:\.\d+)?)\s*(?:mile[rs]?|mi)\b/i);
  if (mi) return parseFloat(mi[1]);
  return Infinity;
}

function sortByDistance(events: string[]): string[] {
  return [...events].sort((a, b) => {
    const da = distanceMiles(a);
    const db = distanceMiles(b);
    if (da !== db) return da - db;
    // Same numeric distance (or both unknown) → stable alphabetical
    return a.localeCompare(b);
  });
}

export default function EventFilter({ events, selected, onChange }: Props) {
  if (events.length <= 1) return null;

  const sorted = sortByDistance(events);
  const allSelected = selected.length === 0;

  function toggleAll() {
    onChange([]);
  }

  function toggleEvent(event: string) {
    if (selected[0] === event) return;
    onChange([event]);
  }

  function isActive(event: string): boolean {
    return !allSelected && selected[0] === event;
  }

  return (
    <div className="event-filter" role="group" aria-label="Filter by event">
      <span className="event-filter-label" id="event-filter-label">Show:</span>
      <button
        type="button"
        className={`event-chip${allSelected ? ' event-chip--active' : ''}`}
        onClick={toggleAll}
        aria-pressed={allSelected}
        aria-describedby="event-filter-label"
      >
        All Events
      </button>
      {sorted.map(event => (
        <button
          type="button"
          key={event}
          className={`event-chip${isActive(event) && !allSelected ? ' event-chip--active' : ''}`}
          onClick={() => toggleEvent(event)}
          aria-pressed={isActive(event)}
          aria-describedby="event-filter-label"
        >
          {event}
        </button>
      ))}
    </div>
  );
}
