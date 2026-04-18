/**
 * Shared “raised” 3D look for buttons: shadow/elevation + subtle top-light / bottom-dark bevel.
 */
import { Platform, type ViewStyle } from 'react-native';
import { StagePassColors } from '@/constants/theme';

/** Primary shadow — iOS uses shadow*, Android elevation. */
export const BUTTON_3D_SHADOW: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
  },
  android: {
    elevation: 7,
  },
  default: {},
}) ?? {};

export const BUTTON_3D_SHADOW_SOFT: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  android: {
    elevation: 3,
  },
  default: {},
}) ?? {};

const BEVEL_W = { borderTopWidth: 1, borderLeftWidth: 1, borderBottomWidth: 1, borderRightWidth: 1 } as const;

/** Yellow / primary (tint) filled buttons */
export const BEVEL_PRIMARY: ViewStyle = {
  ...BEVEL_W,
  borderTopColor: StagePassColors.primaryLight,
  borderLeftColor: StagePassColors.primaryLight,
  borderBottomColor: StagePassColors.primaryDark,
  borderRightColor: StagePassColors.primaryDark,
};

/** Success / secondary filled buttons */
export const BEVEL_SECONDARY: ViewStyle = {
  ...BEVEL_W,
  borderTopColor: '#86efac',
  borderLeftColor: '#86efac',
  borderBottomColor: '#166534',
  borderRightColor: '#166534',
};

/** Destructive filled buttons */
export const BEVEL_DESTRUCTIVE: ViewStyle = {
  ...BEVEL_W,
  borderTopColor: '#fca5a5',
  borderLeftColor: '#fca5a5',
  borderBottomColor: '#991b1b',
  borderRightColor: '#991b1b',
};

/** Outline / ghost buttons on light surfaces */
export function bevelOutlineLight(): ViewStyle {
  return {
    ...BEVEL_W,
    borderTopColor: 'rgba(255,255,255,0.75)',
    borderLeftColor: 'rgba(255,255,255,0.75)',
    borderBottomColor: 'rgba(15,23,42,0.14)',
    borderRightColor: 'rgba(15,23,42,0.14)',
  };
}

/** Outline on dark surfaces */
export function bevelOutlineDark(): ViewStyle {
  return {
    ...BEVEL_W,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderLeftColor: 'rgba(255,255,255,0.14)',
    borderBottomColor: 'rgba(0,0,0,0.45)',
    borderRightColor: 'rgba(0,0,0,0.45)',
  };
}

/** Slightly flattened when pressed */
export const BUTTON_3D_PRESSED: ViewStyle = Platform.select({
  ios: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
  },
  android: { elevation: 3 },
  default: {},
}) ?? {};
