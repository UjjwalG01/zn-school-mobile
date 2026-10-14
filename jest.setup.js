/* global jest */
// AsyncStorage is a native module; use the official in-memory mock in every test.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
