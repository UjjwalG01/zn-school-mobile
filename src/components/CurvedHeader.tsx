import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme/useTheme';
import { HeaderBackdrop } from './HeaderBackdrop';

/**
 * The brand-coloured header with the educational backdrop and the signature curves (UI_SYSTEM §8): its bottom-left corner is
 * rounded, and the screen under it starts with a rounded top-right corner that the brand colour shows behind. Sign-in
 * (`AuthScreen`) and every page header (`BrandHeader`) are built on it, so the two layouts cannot drift apart.
 * It clears the status bar itself. The status bar icons are light for the whole app (root layout) because this header
 * is always the brand colour and is the first thing on every screen.
 */
export function CurvedHeader({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, radius } = useTheme();
  const corner = { position: 'absolute', top: 0, right: 0, width: radius.sheet, height: radius.sheet } as const;
  return (
    <View>
      <SafeAreaView
        edges={['top']}
        style={[{ backgroundColor: colors.brand, overflow: 'hidden', }, style]}
      >
        <HeaderBackdrop />
        {children}
      </SafeAreaView>
      {/* The screen's own top-right curve, drawn here so every screen under a header gets it without styling. */}
      {/* <View style={{ backgroundColor: colors.bg }} accessibilityElementsHidden importantForAccessibility="no"> */}
      {/* <View style={[corner, { backgroundColor: colors.brand }]} /> */}
      {/* <View style={[corner, { backgroundColor: colors.brand, left: 0 }]} /> */}
      {/* <View style={[corner, { backgroundColor: colors.bg, borderTopLeftRadius: radius.sheet, left: 0, top: 0 }]} /> */}
      {/* <View style={[corner, { backgroundColor: colors.bg, borderTopRightRadius: radius.sheet }]} /> */}
      {/* </View> */}
    </View>
  );
}
