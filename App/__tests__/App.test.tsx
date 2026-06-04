/**
 * @format
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-get-random-values', () => ({}));

jest.mock('react-native-rsa-native', () => ({
  RSA: {
    generateKeys: jest.fn(async () => ({
      private:
        '-----BEGIN PRIVATE KEY-----\nMIIBVwIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEAuQ==\n-----END PRIVATE KEY-----',
      public:
        '-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAA==\n-----END PUBLIC KEY-----',
    })),
  },
}));

jest.mock('../src/services/profileStore', () => ({
  initializeProfileStore: jest.fn(async () => undefined),
  listProfiles: jest.fn(async () => []),
  getActiveProfileId: jest.fn(async () => null),
  getRegistrationForProfile: jest.fn(async () => null),
  createProfile: jest.fn(async () => ({
    id: 1,
    displayName: 'Test',
    hasRegistration: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })),
  setActiveProfile: jest.fn(async () => undefined),
  saveRegistrationForProfile: jest.fn(async () => undefined),
  clearRegistrationForProfile: jest.fn(async () => undefined),
}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App.tsx';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
