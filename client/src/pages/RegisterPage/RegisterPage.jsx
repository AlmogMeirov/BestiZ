/**
 * Register page.
 * Renders a form for creating a new BestiZ account.
 * Mirrors LoginPage structure:
 * controlled inputs, async submit handler, server error surfacing, navigate-on-success.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext.jsx';
import Button from '../../components/Button/Button.jsx';
import Input from '../../components/Input/Input.jsx';

import styles from './RegisterPage.module.css';

// The RegisterPage component renders a registration form and handles user sign-up.
// It uses the `useAuth` hook to access the `register` function and `useNavigate` for navigation.
// Form state is managed with `useState` hooks for each input field, 
// as well as for submission status and error messages.
const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({ username, email, displayName, password });
      navigate('/feed');
    } catch (err) {
      const message =
        err?.response?.data?.error || 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Join BestiZ to connect with friends.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            label="Display name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            required
          />
          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          {error && <div className={styles.alert}>{error}</div>}

          <Button type="submit" loading={submitting} fullWidth>
            Create account
          </Button>
        </form>

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" className={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;