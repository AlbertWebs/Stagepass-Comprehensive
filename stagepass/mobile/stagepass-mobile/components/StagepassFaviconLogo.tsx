/**
 * Matches web admin `public/favicon.svg` — rounded tile + “S” mark.
 */
import { Image } from 'react-native';

type Props = {
  size?: number;
};

export function StagepassFaviconLogo({ size = 64 }: Props) {
  return (
    <Image
      accessibilityLabel="Stagepass"
      source={require('../assets/images/favicon.png')}
      style={{ width: size, height: size, borderRadius: size * 0.23 }}
      resizeMode="contain"
    />
  );
}
