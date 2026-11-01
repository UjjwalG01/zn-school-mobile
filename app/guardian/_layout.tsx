// The Ionicons set only, as the teacher shell (the package barrel would bundle every icon font family).
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useGuard } from '../../src/auth/guards';
import { shellHeaderOptions } from '../../src/components/BrandHeader';
import { ShellSwitcher } from '../../src/components/ShellSwitcher';
import { GuardianChildProvider } from '../../src/features/guardian/GuardianChildContext';
import { GUARDIAN_INBOX_HREF } from '../../src/features/guardian/routes';
import { NotificationBell } from '../../src/features/notifications/NotificationBell';
import { t } from '../../src/i18n';
import { iconSize } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Guardian tabs (GV-D9): Home, Attendance, Results, Fees, Profile. The child a tab shows is held by GuardianChildProvider, so every
// child-scoped tab and the child profile share one selection. The Profile screen is the shared one (Switch school, Sign out, shell switcher).
// The child profile and a result's detail are stack screens: hidden from the tab bar, reached from Home and Results.
export default function GuardianLayout() {
  const { colors, typography } = useTheme();
  const guard = useGuard('guardian');
  if (guard.kind === 'wait') return null;
  if (guard.kind === 'redirect') return <Redirect href={guard.href} />;
  return (
    <GuardianChildProvider>
      <Tabs
        screenOptions={{
          ...shellHeaderOptions(<NotificationBell href={GUARDIAN_INBOX_HREF} />),
          headerRight: () => <ShellSwitcher inverse />,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: typography.caption,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('shell.home'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={(focused ? 'home' : 'home-outline') as IconName} color={color} size={iconSize.lg} />
            ),
          }}
        />
        <Tabs.Screen
          name="attendance"
          options={{
            title: t('tabs.attendance'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={(focused ? 'checkmark-circle' : 'checkmark-circle-outline') as IconName}
                color={color}
                size={iconSize.lg}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="results"
          options={{
            title: t('guardian.results.title'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={(focused ? 'ribbon' : 'ribbon-outline') as IconName} color={color} size={iconSize.lg} />
            ),
          }}
        />
        <Tabs.Screen
          name="fees"
          options={{
            title: t('guardian.fees.title'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={(focused ? 'wallet' : 'wallet-outline') as IconName} color={color} size={iconSize.lg} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={(focused ? 'person-circle' : 'person-circle-outline') as IconName}
                color={color}
                size={iconSize.lg}
              />
            ),
          }}
        />
        <Tabs.Screen name="students/[studentId]" options={{ href: null, title: t('guardian.student.title') }} />
        <Tabs.Screen name="results/[resultId]" options={{ href: null, title: t('guardian.results.detailTitle') }} />
        <Tabs.Screen name="inbox" options={{ href: null, title: t('notifications.title') }} />
        <Tabs.Screen name="notices" options={{ href: null, title: t('guardian.notices.title') }} />
        <Tabs.Screen name="calendar" options={{ href: null, title: t('guardian.calendar.title') }} />
      </Tabs>
    </GuardianChildProvider>
  );
}
