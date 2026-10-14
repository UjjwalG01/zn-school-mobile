import { useRouter } from 'expo-router';

import { useMySchools } from './queries';

/** "Switch school" is offered only when my-schools lists more than one. */
export function useSchoolSwitch(): { canSwitch: boolean; openPicker: () => void } {
  const router = useRouter();
  const schools = useMySchools();
  return {
    canSwitch: (schools.data?.length ?? 0) > 1,
    openPicker: () => router.push('/school-picker'),
  };
}
