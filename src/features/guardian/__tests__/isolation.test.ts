// Static isolation and read-only checks for the guardian code (GUARDIAN_V1_PLAN §8, owner requirement 2026-10-31). They read the source,
// so a guardian screen that imports teacher code, calls a staff route, makes a write request or names an invoice or payment route fails here.
// The mobile tsconfig carries no Node typings and no new package is added for this check, so the Node modules Jest runs
// this file with are declared here, with only the members the check uses.
declare const require: (name: string) => unknown;
declare const __dirname: string;
interface NodeFs {
  readdirSync: (dir: string) => string[];
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => { isDirectory: () => boolean };
}
const { readdirSync, readFileSync, statSync } = require('fs') as NodeFs;
const { join } = require('path') as { join: (...parts: string[]) => string };

const ROOT = join(__dirname, '..', '..', '..', '..');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name: string) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : filesUnder(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const GUARDIAN_SOURCES = [
  ...filesUnder(join(ROOT, 'src', 'features', 'guardian')),
  ...filesUnder(join(ROOT, 'app', 'guardian')),
];

const read = (path: string) => readFileSync(path, 'utf8');

describe('guardian isolation', () => {
  it('imports no teacher code, in either direction', () => {
    const offending = GUARDIAN_SOURCES.filter((path) => /from ['"][^'"]*\/teacher\//.test(read(path)));
    expect(offending).toEqual([]);
  });

  it('calls no staff route (only the guardian, notices and notifications paths the app is allowed)', () => {
    const staffRoutes = /['"`](\/)(finance|academic|attendance|leave|students|staff|tenancy|identity|guardians|reports|exam)/;
    const offending = GUARDIAN_SOURCES.filter((path) => staffRoutes.test(read(path)));
    expect(offending).toEqual([]);
  });

  it('makes no write request: no POST, PATCH, PUT or DELETE in guardian code (mark-read lives in the shared inbox)', () => {
    const writes = /\b(apiPost|apiPatch|apiPut|apiDelete)\s*[<(]/;
    expect(GUARDIAN_SOURCES.filter((path) => writes.test(read(path)))).toEqual([]);
  });

  it('names no invoice, receipt or payment route and no payment action', () => {
    const financeActions = /\/invoices|\/receipt|\/payments|make[ -]?payment|pay now/i;
    const offending = GUARDIAN_SOURCES.filter((path) => financeActions.test(read(path)));
    expect(offending).toEqual([]);
  });
});
