import './EventFilter.css';

interface Props {
  events: string[];
  selected: string[];  // empty = all
  onChange: (selected: string[]) => void;
}

export default function EventFilter({ events, selected, onChange }: Props) {
  if (events.length <= 1) return null;

  const allSelected = selected.length === 0;

  function toggleAll() {
    onChange([]);
  }

  function toggleEvent(event: string) {
    if (selected.includes(event)) {
      const next = selected.filter(e => e !== event);
      onChange(next.length === events.length ? [] : next);
    } else {
      const next = [...selected, event];
      onChange(next.length === events.length ? [] : next);
    }
  }

  function isActive(event: string): boolean {
    return allSelected || selected.includes(event);
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
      {events.map(event => (
        <button
          type="button"
          key={event}
          className={`event-chip${isActive(event) && !allSelected ? ' event-chip--active' : ''}`}
          onClick={() => toggleEvent(event)}
          aria-pressed={isActive(event) && !allSelected}
          aria-describedby="event-filter-label"
        >
          {event}
        </button>
      ))}
    </div>
  );
}
