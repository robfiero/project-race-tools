import { useState, useRef, useEffect, useId, type KeyboardEvent } from 'react';
import { STANDARD_THEMES, HOLIDAY_THEMES } from '../themes.ts';
import { useTheme } from '../ThemeContext.tsx';
import './ThemeSwitcher.css';

export default function ThemeSwitcher() {
  const { theme, setThemeById } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedOption = menuRef.current?.querySelector<HTMLButtonElement>(`[data-theme-id="${theme.id}"]`);
    selectedOption?.focus();
  }, [open, theme.id]);

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="option"]') ?? []);
    if (items.length === 0) return;
    const currentIndex = Math.max(items.findIndex(item => item === document.activeElement), 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(currentIndex + 1) % items.length].focus();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length].focus();
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div className="theme-switcher" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="theme-dropdown-trigger"
        onClick={() => setOpen(o => !o)}
        onKeyDown={onTriggerKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={menuId}
        aria-label={`Theme selector. Current theme: ${theme.label}`}
      >
        <span className="theme-dots">
          <span className="theme-dot" style={{ background: theme.primary }} />
          <span className="theme-dot" style={{ background: theme.chart[1] }} />
        </span>
        <span className="theme-dropdown-name">{theme.label}</span>
        <span className="theme-dropdown-arrow" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          className="theme-dropdown-menu"
          role="listbox"
          aria-label="Select theme"
          onKeyDown={onMenuKeyDown}
        >
          <div className="theme-dropdown-group-label">Standard</div>
          {STANDARD_THEMES.map(t => (
            <button
              type="button"
              key={t.id}
              data-theme-id={t.id}
              className={`theme-dropdown-option${t.id === theme.id ? ' theme-dropdown-option--active' : ''}`}
              role="option"
              aria-selected={t.id === theme.id}
              tabIndex={t.id === theme.id ? 0 : -1}
              onClick={() => { setThemeById(t.id); setOpen(false); }}
            >
              <span className="theme-dots">
                <span className="theme-dot" style={{ background: t.primary }} />
                <span className="theme-dot" style={{ background: t.chart[1] }} />
              </span>
              <span>{t.label}</span>
            </button>
          ))}

          <div className="theme-dropdown-separator" aria-hidden="true" />
          <div className="theme-dropdown-group-label">Holiday</div>
          {HOLIDAY_THEMES.map(t => (
            <button
              type="button"
              key={t.id}
              data-theme-id={t.id}
              className={`theme-dropdown-option${t.id === theme.id ? ' theme-dropdown-option--active' : ''}`}
              role="option"
              aria-selected={t.id === theme.id}
              tabIndex={t.id === theme.id ? 0 : -1}
              onClick={() => { setThemeById(t.id); setOpen(false); }}
            >
              <span className="theme-dots">
                <span className="theme-dot" style={{ background: t.primary }} />
                <span className="theme-dot" style={{ background: t.chart[1] }} />
              </span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
