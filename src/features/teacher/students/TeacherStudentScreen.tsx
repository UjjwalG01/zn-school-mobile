// A student's details for a teacher (docs/project/STUDENT_INFO_PLAN.md §3). Everything shown is what
// `GET /portal/teacher/students/:id` returns for a student the backend allowed; the app adds nothing and
// decides nothing. No edit, copy or share action.
import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';

import { ApiError } from '../../../api/errors';
import type { TeacherStudent, TeacherStudentEnrollment } from '../../../api/types/portal';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { OfflineBanner, savedDataTimestamp } from '../../../components/OfflineBanner';
import { QueryState, queryView } from '../../../components/QueryState';
import { Screen } from '../../../components/Screen';
import { StatusBadge } from '../../../components/StatusBadge';
import { Text } from '../../../components/Text';
import { t } from '../../../i18n';
import { type CalendarPreference, formatDate } from '../../../lib/date';
import { showToast } from '../../../lib/toast';
import { useTheme } from '../../../theme/useTheme';
import { useRefreshSchoolsOnFeatureDenied } from '../../featureDenied';
import { useTenantSettings } from '../../queries';
import { useManualRefresh } from '../../useManualRefresh';
import { placementLabel } from '../placement';
import { useTeacherStudent } from './queries';
import {
  dialable,
  genderText,
  relationshipText,
  splitEnrollments,
  statusText,
  statusTone,
} from './studentModel';

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const NONE = '—';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text>{value}</Text>
    </View>
  );
}

function EnrollmentLine({ enrollment }: { enrollment: TeacherStudentEnrollment }) {
  const { spacing } = useTheme();
  const where = placementLabel(enrollment);
  const roll = enrollment.rollNumber ? t('attendance.roll', { number: enrollment.rollNumber }) : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
      <Text style={{ flex: 1 }}>{[enrollment.academicYearLabel, where, roll].filter(Boolean).join(' · ')}</Text>
      <StatusBadge label={statusText(enrollment.status)} tone={statusTone(enrollment.status)} />
    </View>
  );
}

async function callGuardian(phone: string) {
  try {
    await Linking.openURL(`tel:${dialable(phone)}`);
  } catch {
    showToast(t('studentInfo.callFailed'), 'error');
  }
}

function Profile({ data, calendar }: { data: TeacherStudent; calendar: CalendarPreference | undefined }) {
  const { spacing } = useTheme();
  const { student, guardians, enrollments } = data;
  const { current, earlier } = splitEnrollments(enrollments);

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="title" accessibilityRole="header">
              {student.fullName}
            </Text>
            <Text tone="muted">{t('studentInfo.admission', { number: student.admissionNumber })}</Text>
          </View>
          <StatusBadge label={statusText(student.status)} tone={statusTone(student.status)} />
        </View>
      </Card>

      <Card>
        <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
          {t('studentInfo.class')}
        </Text>
        {current ? (
          <>
            <EnrollmentLine enrollment={current} />
            {earlier.length > 0 ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="caption" tone="muted">
                  {t('studentInfo.earlier')}
                </Text>
                {earlier.map((enrollment) => (
                  <EnrollmentLine key={enrollment.id} enrollment={enrollment} />
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text tone="muted">{NONE}</Text>
        )}
      </Card>

      <Card>
        <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
          {t('studentInfo.personal')}
        </Text>
        <Field
          label={t('studentInfo.dob')}
          // The tenant's calendar decides how a date is written; none is assumed (OfflineBanner does the same).
          value={student.dateOfBirth && calendar ? formatDate(student.dateOfBirth, calendar) : NONE}
        />
        <Field label={t('studentInfo.gender')} value={student.gender ? genderText(student.gender) : NONE} />
        <Field label={t('studentInfo.blood')} value={student.bloodGroup ?? NONE} />
      </Card>

      <Card>
        <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
          {t('studentInfo.guardians')}
        </Text>
        {guardians.length === 0 ? <Text tone="muted">{t('studentInfo.noGuardians')}</Text> : null}
        {guardians.map((guardian) => (
          <View key={guardian.guardianId} style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ flexShrink: 1 }}>{`${guardian.fullName} · ${relationshipText(guardian.relationship)}`}</Text>
              {guardian.isPrimary ? <StatusBadge label={t('studentInfo.primary')} tone="neutral" /> : null}
            </View>
            {guardian.phone ? (
              <Button
                variant="link"
                title={t('studentInfo.call', { phone: guardian.phone })}
                onPress={() => void callGuardian(guardian.phone!)}
              />
            ) : null}
          </View>
        ))}
      </Card>
    </View>
  );
}

export default function TeacherStudentScreen() {
  const params = useLocalSearchParams<{ studentId?: string }>();
  const studentId = single(params.studentId) ?? null;
  const query = useTeacherStudent(studentId);
  const calendar = useTenantSettings().data?.calendarPreference;
  useRefreshSchoolsOnFeatureDenied(query.error);
  const { refreshing, onRefresh } = useManualRefresh(() => query.refetch());

  const title = <Stack.Screen options={{ title: query.data?.student.fullName ?? t('studentInfo.title') }} />;
  // A link with no id, or the 404 only an `attendance.mark_any` holder gets for a missing student.
  const notFound =
    studentId === null || (query.error instanceof ApiError && query.error.status === 404 && query.data === undefined);
  const view = queryView(query);

  return (
    <>
      {title}
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <OfflineBanner asOf={savedDataTimestamp([query])} />
        {query.data !== undefined ? (
          <Profile data={query.data} calendar={calendar} />
        ) : notFound ? (
          <Text tone="muted">{t('studentInfo.notFound')}</Text>
        ) : view === 'noAccess' ? (
          // A student outside the teacher's classes, an unlinked account and an id that does not exist all
          // answer the same 403, so the screen says it once and does not try to tell them apart.
          <Text tone="muted">{t('studentInfo.noAccess')}</Text>
        ) : view === 'offline' ? (
          <Text tone="muted">{t('studentInfo.offline')}</Text>
        ) : (
          <QueryState query={query}>{null}</QueryState>
        )}
      </Screen>
    </>
  );
}
