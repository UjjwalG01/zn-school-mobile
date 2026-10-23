// The Ionicons set only: the package barrel would bundle every icon font family.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useGuard } from '../../src/auth/guards';
import { ShellSwitcher } from '../../src/components/ShellSwitcher';
import { featureRegistry } from '../../src/features/registry';
import { routeName } from '../../src/features/routes';
import { useVisibilityContext } from '../../src/features/useVisibleFeatures';
import { visibleTabs } from '../../src/features/visibility';
import { t } from '../../src/i18n';
import { useHeaderOptions, useTheme } from '../../src/theme/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Tabs come from the feature registry (FEATURE_MODULES). A tab feature needs a route file named by
// `routeName(id)`; a tab the user may not see keeps its route but gets no tab (`href: null`). Profile
// has no rule that can hide it, so the bar is never empty and Sign out is always reachable.
// Path is /teacher (a real segment) so teacher and guardian tab names can never collide.
const teacherTabs = featureRegistry.filter(
  (feature) => feature.audience === 'teacher' && feature.placement === 'tab',
);

export default function TeacherLayout() {
  const guard = useGuard('teacher');
  const { colors } = useTheme();
  const header = useHeaderOptions();
  const context = useVisibilityContext('teacher');
  if (guard.kind === 'wait') return null;
  if (guard.kind === 'redirect') return <Redirect href={guard.href} />;
  // Permissions or the school are not loaded: let /resolve load them (and show its error screen).
  if (context === null) return <Redirect href="/resolve" />;

  const visibleIds = new Set(visibleTabs(featureRegistry, context).map((feature) => feature.id));
  return (
    // No per-school `key`: a school switch clears the shell, so the guard above unmounts the tabs and
    // the new school's are built fresh; a roster of the previous school cannot outlive the switch.
    <Tabs
      screenOptions={{
        ...header,
        headerRight: () => <ShellSwitcher />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      {teacherTabs.map((feature) => (
        <Tabs.Screen
          key={feature.id}
          name={routeName(feature.id)}
          options={
            visibleIds.has(feature.id)
              ? {
                  title: t(feature.title),
                  // The active tab gets the filled glyph, so the state is not carried by colour alone.
                  tabBarIcon: ({ color, size, focused }) => (
                    <Ionicons
                      name={(focused ? feature.icon.replace(/-outline$/, '') : feature.icon) as IconName}
                      color={color}
                      size={size}
                    />
                  ),
                  ...(feature.stack ? { headerShown: false } : {}),
                }
              : { href: null }
          }
        />
      ))}
    </Tabs>
  );
}
