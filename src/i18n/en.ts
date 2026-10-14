// English strings. Components use keys only (docs/frontend/UI_SYSTEM.md §4). `ne.ts` must define
// every key here — the type enforces it.
export const en = {
  'common.show': 'Show',
  'common.hide': 'Hide',
  'common.back': 'Back',

  'auth.brand': 'ZN School',
  'auth.tagline': 'Sign in to your school',
  'auth.identifier.label': 'Phone or email',
  'auth.password.label': 'Password',
  'auth.submit': 'Sign in',
  'auth.activate': 'Activate account',

  'auth.error.identifierRequired': 'Enter your phone or email.',
  'auth.error.invalidEmail': 'Enter a valid email address.',
  'auth.error.phoneSoon': 'Phone sign-in coming soon. Please use your email for now.',
  'auth.error.passwordRequired': 'Enter your password.',
  'auth.error.invalidCredentials': 'Incorrect email or password. Please try again.',
  'auth.error.tooManyAttempts': 'Too many attempts. Wait a few minutes before trying again.',
  'auth.error.offline': 'Could not reach the server. Check your connection and try again.',
  'auth.error.validation': 'Check your details and try again.',
  'auth.error.server': 'Something went wrong on our side. Please try again.',
  'auth.error.storage': 'Could not save your session on this device. Please try again.',
  'auth.error.generic': 'Could not sign in. Please try again.',

  'activate.title': 'Activate account',
  'activate.body':
    'Account activation is coming soon. Keep the activation code from your school ready.',

  'auth.notice.sessionExpired': 'Your session has expired. Please sign in again.',

  'common.retry': 'Try again',
  'common.signOut': 'Sign out',
  'common.loading': 'Loading…',

  'context.error.title': 'Could not load your account',
  'context.error.offline': 'Could not reach the server. Check your connection and try again.',
  'context.error.generic': 'Something went wrong. Please try again.',

  'noSchool.title': 'No school access',
  'noSchool.body':
    'Your account is not linked to any school yet. Contact your school administrator.',

  'picker.title': 'Choose your school',
  'picker.body': 'Select the school you want to open.',

  'useWeb.title': 'Use the web app',
  'useWeb.body':
    'Your role in this school is not available in the mobile app. Please use the ZN School web app.',

  'unavailable.title': 'School unavailable',
  'unavailable.license':
    'The ZN School service is not available for this school right now. Contact your school.',
  'unavailable.suspended':
    'Access to this school is suspended or archived. Contact your school.',

  'shell.teacher': 'Teacher',
  'shell.guardian': 'Guardian',
  'shell.home': 'Home',
  'shell.placeholder': 'Features for this area are coming soon.',
  'shell.school': 'School',
  'shell.signedInAs': 'Signed in as {name}',
  'shell.switchSchool': 'Switch school',
  'shell.switchTo': 'Switch to {shell}',
} as const;

export type MessageKey = keyof typeof en;
