// Attendance tab, first screen: the subtabs Student Attendance (class list, then roster) and My
// Attendance (the teacher's own presence). Each subtab shows only when the same visibility rule the
// manifests use allows it; with one left no control is drawn (docs/project/TEACHER_APP_PLAN.md §4).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { SegmentedControl } from '../../../components/SegmentedControl';
import { t } from '../../../i18n';
import { gutter } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';
import { useVisibilityContext } from '../../useVisibleFeatures';
import { isFeatureVisible } from '../../visibility';
import { TEACHER_ATTENDANCE_ACCESS, TEACHER_SELF_ATTENDANCE_ACCESS } from '../access';
import MyAttendanceScreen from '../selfAttendance/MyAttendanceScreen';
import ClassListScreen from './ClassListScreen';

type Subtab = 'students' | 'self';

export default function AttendanceTabScreen() {
  const { colors, spacing } = useTheme();
  const ctx = useVisibilityContext('teacher');
  const showStudents = ctx !== null && isFeatureVisible(TEACHER_ATTENDANCE_ACCESS, ctx);
  const showSelf = ctx !== null && isFeatureVisible(TEACHER_SELF_ATTENDANCE_ACCESS, ctx);
  // The `subtab` route param is the only record of the open subtab: the control writes it and the
  // Dashboard link (`attendance/routes.ts`) names it. A tab that stays mounted therefore never
  // disagrees with a link that asks for the subtab it already shows. Absent, it is Student Attendance.
  const router = useRouter();
  const { subtab } = useLocalSearchParams<{ subtab?: string }>();

  // A hidden subtab can never be the active one, whatever the param says.
  const active: Subtab = showSelf && (!showStudents || subtab === 'self') ? 'self' : 'students';

  // The control sits above the subtab's own scroll area, so it stays on screen while a long list scrolls.
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {showStudents && showSelf ? (
        <View style={{ paddingHorizontal: gutter, paddingTop: spacing.lg }}>
          <SegmentedControl
            accessibilityLabel={t('attendance.subtabs')}
            value={active}
            onChange={(value) => router.setParams({ subtab: value })}
            options={[
              { value: 'students', label: t('attendance.studentTab') },
              { value: 'self', label: t('selfAttendance.title') },
            ]}
          />
        </View>
      ) : null}
      {active === 'self' ? <MyAttendanceScreen /> : <ClassListScreen skipSingle={showSelf} />}
    </View>
  );
}
