/**
 * Login screen tests – render and key UI elements.
 * Heavy dependencies (router, Redux, theme, reanimated, secure store) are mocked.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import LoginScreen from '../login';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(),
}));
jest.mock('~/context/ThemePreferenceContext', () => ({
  useThemePreference: () => ({ setPreference: jest.fn() }),
}));
jest.mock('~/hooks/use-stagepass-theme', () => ({
  useStagePassTheme: () => ({
    colors: { text: '#000', textSecondary: '#666', placeholder: '#999' },
    isDark: false,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock('~/store/persistAuth', () => ({
  getLastUsername: jest.fn().mockResolvedValue(''),
  getLoginLockoutUntil: jest.fn().mockResolvedValue(null),
  saveToken: jest.fn(),
  setLastUsername: jest.fn(),
  setLoginLockoutUntil: jest.fn(),
}));
jest.mock('~/utils/pushToken', () => ({ getDevicePushTokenAsync: jest.fn().mockResolvedValue(null) }));
jest.mock('~/services/api', () => ({
  getApiBase: () => 'http://test',
  setAuthToken: jest.fn(),
  api: { auth: { login: jest.fn(), me: jest.fn() } },
}));
jest.mock('@/src/utils/navigationPress', () => ({
  useNavigationPress: () => ({ handleNav: jest.fn() }),
  NAV_PRESSED_OPACITY: 0.7,
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

describe('LoginScreen', () => {
  it('renders Welcome Back and Sign In', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Welcome Back')).toBeTruthy();
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('renders username and PIN inputs', () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText('Enter your username')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••')).toBeTruthy();
  });
});
