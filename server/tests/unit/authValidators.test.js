/**
 * Unit tests for the registration and login schemas.
 *
 * These are the app's outermost gate: every value that reaches a service or a
 * SQL query passes through here first. The tests below pin down the rules the
 * schemas actually enforce, so a future refactor can't quietly loosen them.
 */

import { describe, expect, it } from 'vitest';

import { loginSchema, registerSchema } from '../../src/validators/authValidators.js';

const validRegistration = {
  username: 'almog_dev',
  email: 'almog@example.com',
  password: 'Str0ng!Password',
  displayName: 'Almog',
};

// Small helper: asserts the schema rejects the input and returns the message.
const rejectionMessage = (schema, input) => {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  return result.error.issues[0].message;
};

describe('registerSchema - happy path', () => {
  it('accepts a well-formed registration', () => {
    const result = registerSchema.safeParse(validRegistration);
    expect(result.success).toBe(true);
  });

  it('trims surrounding whitespace from the display name', () => {
    const result = registerSchema.parse({
      ...validRegistration,
      displayName: '  Almog  ',
    });
    expect(result.displayName).toBe('Almog');
  });
});

describe('registerSchema - username rules', () => {
  it('rejects a username shorter than 3 characters', () => {
    const message = rejectionMessage(registerSchema, {
      ...validRegistration,
      username: 'ab',
    });
    expect(message).toMatch(/at least 3/i);
  });

  it('rejects a username longer than 30 characters', () => {
    const message = rejectionMessage(registerSchema, {
      ...validRegistration,
      username: 'a'.repeat(31),
    });
    expect(message).toMatch(/at most 30/i);
  });

  it.each([
    ['a space', 'almog dev'],
    ['a hyphen', 'almog-dev'],
    ['an at sign', 'almog@dev'],
    ['a SQL quote', "almog'--"],
  ])('rejects a username containing %s', (_label, username) => {
    const result = registerSchema.safeParse({ ...validRegistration, username });
    expect(result.success).toBe(false);
  });

  it('accepts letters, digits and underscores', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      username: 'Almog_99',
    });
    expect(result.success).toBe(true);
  });
});

describe('registerSchema - password rules', () => {
  it.each([
    ['too short', 'Ab!1'],
    ['no uppercase', 'weak!password'],
    ['no special character', 'WeakPassword1'],
  ])('rejects a password that is %s', (_label, password) => {
    const result = registerSchema.safeParse({ ...validRegistration, password });
    expect(result.success).toBe(false);
  });

  it('accepts a password meeting every rule at the minimum length', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: 'Abcdef!1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a password over the 100 character ceiling', () => {
    // The upper bound matters: bcrypt silently truncates long inputs, and an
    // unbounded string is a cheap way to burn server CPU on every login.
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: `A!${'a'.repeat(120)}`,
    });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema - email and display name', () => {
  it.each(['not-an-email', 'missing@domain', '@example.com'])(
    'rejects the malformed email %s',
    (email) => {
      const result = registerSchema.safeParse({ ...validRegistration, email });
      expect(result.success).toBe(false);
    }
  );

  it('rejects an empty display name', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      displayName: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a display name over 50 characters', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      displayName: 'a'.repeat(51),
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts a username as the identifier', () => {
    const result = loginSchema.safeParse({
      identifier: 'almog_dev',
      password: 'anything',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an email as the identifier', () => {
    const result = loginSchema.safeParse({
      identifier: 'almog@example.com',
      password: 'anything',
    });
    expect(result.success).toBe(true);
  });

  it('does not apply the registration password rules to login', () => {
    // Deliberate: enforcing strength rules at login would tell an attacker
    // which accounts still hold a weak legacy password.
    const result = loginSchema.safeParse({
      identifier: 'almog_dev',
      password: 'x',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty identifier', () => {
    const result = loginSchema.safeParse({ identifier: '', password: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({
      identifier: 'almog_dev',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});
