/**
 * FilterTabs.
 * A horizontal segmented control: a row of pill-shaped buttons where exactly one is "active" at a time.
 * Used at the top of the feed to switch between All / Mine / Friends.
 * Designed as a generic, reusable widget pass any options and anychange handler.
 * The caller owns the active state.
 * Accessibility: rendered as a `tablist` so screen readers announce it correctly.
 * Each option gets `aria-selected` and keyboard focus.
 */

import styles from './FilterTabs.module.css';

const FilterTabs = ({ options, value, onChange, className = '' }) => {
  return (
    <div
      className={`${styles.tabs} ${className}`}
      role="tablist"
      aria-label="Filter posts"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default FilterTabs;