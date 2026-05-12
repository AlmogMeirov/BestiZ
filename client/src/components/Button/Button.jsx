/**
 * Reusable Button component.
 * Variants:
 *  - primary (default): solid color, used for main actions like "Login".
 *  - secondary: outlined, used for less prominent actions.
 * - danger: solid red, used for destructive actions like "Delete".
 * Supports a `loading` prop that disables the button and changes the label,which is useful while a form is being submitted.
 */

import styles from './Button.module.css';

// Button component definition
const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  loading = false,
  disabled = false,
  onClick,
  fullWidth = false,
}) => {
  const className = [
    styles.button,
    styles[variant],
    fullWidth ? styles.fullWidth : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
};

export default Button;