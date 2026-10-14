// Hand-written from the backend ENDPOINTS.md (ARCHITECTURE §9, A6). Only fields the app uses.

export interface SchoolLicense {
  status: string;
  tierName: string | null;
  validUntil: string | null;
  expiringSoon: boolean;
  /** Licensed modules — feeds the feature visibility rule. */
  modules: string[];
}

/** One row of `GET /tenancy/my-schools`. `tenantId` is the only source of a tenant id. */
export interface School {
  tenantId: string;
  name: string;
  status: string;
  license: SchoolLicense;
}

/** `GET /tenancy/my-permissions?tenantId=` — a UX hint only (ADR-0038). */
export interface MyPermissions {
  all: boolean;
  keys: string[];
}
