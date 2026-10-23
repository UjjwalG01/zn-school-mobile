import { Image } from 'react-native';

const logo = require('../../assets/brand/logo.png');

/**
 * The app logo. It is a placeholder: replace `assets/brand/logo.png` (square, transparent, a light mark, because it sits
 * on the brand colour) and nothing else changes.
 */
export function BrandLogo({ size }: { size: number }) {
  // Decorative: the app name is always written next to it.
  return (
    <Image
      source={logo}
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
