// Typed requests for student attendance and the teacher's own attendance (docs/api/API_CONTRACT.md §2;
// backend ENDPOINTS.md §7 and §7b).
// `tenantId` is attached by the client (selected school) as a query param on every call, including
// the POST: the bulk DTO has no `tenantId` field, so it must not be put in the body.
import { apiGet, apiPost } from './client';
import type {
  AttendanceRoster,
  AttendanceSettings,
  BulkAttendanceRequest,
  BulkAttendanceResult,
  MarkPresentResult,
  MyAttendance,
} from './types/attendance';

export interface RosterQuery {
  date: string;
  classId: string;
  /** null = a class with no sections: the param is left out. */
  sectionId: string | null;
}

/** `GET /attendance/roster` — the students of one class/section on a date, with that day's records. */
export const getAttendanceRoster = ({ date, classId, sectionId }: RosterQuery) => {
  const parts = [`date=${encodeURIComponent(date)}`, `classId=${encodeURIComponent(classId)}`];
  if (sectionId) parts.push(`sectionId=${encodeURIComponent(sectionId)}`);
  return apiGet<AttendanceRoster>(`/attendance/roster?${parts.join('&')}`);
};

/** `GET /attendance/settings` — the school's status labels, short codes and active flags. */
export const getAttendanceSettings = () => apiGet<AttendanceSettings>('/attendance/settings');

/**
 * `POST /attendance/records/bulk` — one class/section/date, all-or-nothing, 1–200 rows. A refused
 * batch resolves as `{ ok: false, failures }` (it is not an ApiError): the caller must branch on `ok`.
 */
export const postBulkAttendance = (body: BulkAttendanceRequest) =>
  apiPost<BulkAttendanceResult>('/attendance/records/bulk', body);

/**
 * `GET /attendance/staff/self` — the caller's own records for a month (`YYYY-MM`; the school's current
 * month when omitted) plus today's state. 404 = the account is not linked to a staff member.
 */
export const getMyAttendance = (month?: string) =>
  apiGet<MyAttendance>(
    month ? `/attendance/staff/self?month=${encodeURIComponent(month)}` : '/attendance/staff/self',
  );

/** `POST /attendance/staff/self` — "Mark present" for the caller, today. No body: the server decides who and when. */
export const markMyselfPresent = () => apiPost<MarkPresentResult>('/attendance/staff/self');
