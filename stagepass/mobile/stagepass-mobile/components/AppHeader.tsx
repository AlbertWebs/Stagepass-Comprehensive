/**
 * Re-exports the uniform app header. Use HomeHeader or AppHeader interchangeably –
 * same component: title left, optional back, chat + logout right (compact).
 */
import { HomeHeader, type HomeHeaderProps } from '@/components/HomeHeader';

export type AppHeaderProps = HomeHeaderProps;

export function AppHeader(props: AppHeaderProps) {
  return <HomeHeader {...props} />;
}
