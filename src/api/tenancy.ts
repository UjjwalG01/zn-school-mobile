// Typed requests for /tenancy/* (docs/api/API_CONTRACT.md §2).
import { apiGet } from './client';
import type { MyPermissions, School } from './types/tenancy';

/** `GET /tenancy/my-schools` — the only source of a `tenantId`. Not tenant-scoped. */
export const getMySchools = () => apiGet<School[]>('/tenancy/my-schools', { skipTenant: true });

/** `GET /tenancy/my-permissions?tenantId=` — `tenantId` is attached by the client (selected school). */
export const getMyPermissions = () => apiGet<MyPermissions>('/tenancy/my-permissions');
