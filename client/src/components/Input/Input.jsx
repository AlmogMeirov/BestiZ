/**
 * Reusable Input component.
 * Bundles a label, the input field, and an optional error message into one consistent visual unit.
 * Designed for use inside forms.
 * Props:
 *  - label: text shown above the input (also used as accessible label)
 *  - error: error message shown below, styles the input red when present
 *  - all native input props (type, value, onChange, placeholder, etc.) pass through
 */

import { useId } from 'react';
import styles from './Input.module.css';

const Input = ({ label, error, type = 'text', ...rest }) => {
  // Auto-generate a unique id so the label can be properly linked to the input.
  // Important for accessibility, clicking the label focuses the input.
  const inputId = useId();

  const inputClassName = [styles.input, error ? styles.inputError : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <input id={inputId} type={type} className={inputClassName} {...rest} />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
};

export default Input;