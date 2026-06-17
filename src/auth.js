import { propertyKeyForSite } from './constants.js';
import { normalizeBoolean } from './sheets.js';

export function findAuthorizedUser(users, email) {
  const target = String(email || '').trim().toLowerCase();
  if (!target) return null;
  return users.find((user) => String(user.email || '').trim().toLowerCase() === target && normalizeBoolean(user.active)) || null;
}

export function getCredentialPropertyKeys(siteKey) {
  return {
    usernameKey: propertyKeyForSite(siteKey, 'USERNAME'),
    passwordKey: propertyKeyForSite(siteKey, 'APP_PASSWORD'),
  };
}

export function readWordPressCredentials(siteKey, properties) {
  const { usernameKey, passwordKey } = getCredentialPropertyKeys(siteKey);
  return {
    username: properties.getProperty(usernameKey) || '',
    appPassword: properties.getProperty(passwordKey) || '',
  };
}

export function maskCredentialStatus(credentials) {
  return {
    hasUsername: Boolean(credentials.username),
    hasAppPassword: Boolean(credentials.appPassword),
  };
}

export function assertAuthorizedUser(users, email) {
  const user = findAuthorizedUser(users, email);
  if (!user) {
    throw new Error(`Unauthorized user: ${email || 'unknown'}`);
  }
  return user;
}
