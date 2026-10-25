// Academic Calendar (teacher.calendar, in the More hub): the school's month with its events, holidays and the person's
// own approved leave marked, the day that was tapped, the events coming up and the latest notices. Read only: the app
// owns no event or notice, and the server decides what this person may see (audience, staff type, class assignment).
// The blocks are shared with the Dashboard (`CalendarSections.tsx`).
import { OfflineBanner } from '../../../components/OfflineBanner';
import { QueryState } from '../../../components/QueryState';
import { Screen } from '../../../components/Screen';
import { useManualRefresh } from '../../useManualRefresh';
import { CalendarBoard, NoticeList, UpcomingEvents } from './CalendarSections';
import { useCalendarBoard } from './useCalendarBoard';

export default function CalendarScreen() {
  const board = useCalendarBoard();
  const { refreshing, onRefresh } = useManualRefresh(board.refetchAll);

  if (!board.ready) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <QueryState query={board.gate}>{null}</QueryState>
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <OfflineBanner asOf={board.savedFrom} />
      <CalendarBoard board={board} />
      <UpcomingEvents board={board} />
      <NoticeList board={board} />
    </Screen>
  );
}
