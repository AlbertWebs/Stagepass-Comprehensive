/**
 * Matches web admin `public/favicon.svg` — rounded tile + “S” mark.
 */
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

type Props = {
  size?: number;
};

export function StagepassFaviconLogo({ size = 64 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Rect width="64" height="64" rx="14" fill="#172455" />
      <SvgText
        x="32"
        y="44"
        fontSize="36"
        fontWeight="700"
        fill="#ca8a04"
        textAnchor="middle"
      >
        S
      </SvgText>
    </Svg>
  );
}
