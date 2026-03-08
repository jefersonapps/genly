import { Platform, ViewStyle } from 'react-native';

type ShadowSizes = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'none';

/**
 * Predefined shadows matching Tailwind CSS sizes for React Native,
 * safe for use across platforms without triggering React Navigation bugs.
 */
export const shadows: Record<ShadowSizes, ViewStyle> = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: {
      elevation: 2,
    },
    default: {
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    } as any,
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    },
    android: {
      elevation: 4,
    },
    default: {
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    } as any,
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 15,
    },
    android: {
      elevation: 8,
    },
    default: {
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    } as any,
  }),
  xl: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.1,
      shadowRadius: 25,
    },
    android: {
      elevation: 12,
    },
    default: {
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    } as any,
  }),
  '2xl': Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 25 },
      shadowOpacity: 0.25,
      shadowRadius: 50,
    },
    android: {
      elevation: 24,
    },
    default: {
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    } as any,
  }),
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};
