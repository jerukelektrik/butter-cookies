import test from 'node:test';
import assert from 'node:assert/strict';
import { findAuthorizedUser, getCredentialPropertyKeys, maskCredentialStatus } from '../src/auth.js';

test('findAuthorizedUser returns active matching user case-insensitively', () => {
  const users = [
    { email: 'editor@example.com', active: 'FALSE' },
    { email: 'Owner@Example.com', active: 'TRUE' },
  ];
  assert.deepEqual(findAuthorizedUser(users, 'owner@example.com'), { email: 'Owner@Example.com', active: 'TRUE' });
});

test('findAuthorizedUser returns null for inactive or missing users', () => {
  assert.equal(findAuthorizedUser([{ email: 'a@example.com', active: 'FALSE' }], 'a@example.com'), null);
  assert.equal(findAuthorizedUser([], 'a@example.com'), null);
});

test('credential property keys are normalized per site', () => {
  assert.deepEqual(getCredentialPropertyKeys('ruang guru'), {
    usernameKey: 'WP_RUANG_GURU_USERNAME',
    passwordKey: 'WP_RUANG_GURU_APP_PASSWORD',
  });
});

test('maskCredentialStatus reports missing keys without leaking values', () => {
  assert.deepEqual(maskCredentialStatus({ username: 'admin', appPassword: '' }), {
    hasUsername: true,
    hasAppPassword: false,
  });
});
