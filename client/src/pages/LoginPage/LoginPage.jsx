/**
 * Login page.
 * Renders a form with identifier (email or username) + password fields.
 * On submit, calls the auth context login function which talks to the server.
 * On success, navigates to the feed.
 * On failure, shows the server's error message.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext.jsx';
import Button from '../../components/Button/Button.jsx';
import Input from '../../components/Input/Input.jsx';

import styles from './LoginPage.module.css';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Form state — one piece of state per field plus a submit/error state.
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ identifier, password });
      // On success, send the user to the feed (or wherever the app's home is).
      navigate('/feed');
    } catch (err) {
      // Try to surface the server's error message; fall back to a generic one.
      const message = err?.response?.data?.error || 'Login failed. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to your BestiZ account.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            label="Email or username"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && <div className={styles.alert}>{error}</div>}

          <Button type="submit" loading={submitting} fullWidth>
            Sign in
          </Button>
        </form>

        <p className={styles.footer}>
          Don&apos;t have an account?{' '}
          <Link to="/register" className={styles.link}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;