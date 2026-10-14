import type { MessageKey } from './en';

// Nepali strings — drafted by the assistant; needs review by a fluent speaker before release.
export const ne: Record<MessageKey, string> = {
  'common.show': 'देखाउनुहोस्',
  'common.hide': 'लुकाउनुहोस्',
  'common.back': 'फर्कनुहोस्',

  'auth.brand': 'ZN School',
  'auth.tagline': 'आफ्नो विद्यालयमा साइन इन गर्नुहोस्',
  'auth.identifier.label': 'फोन वा इमेल',
  'auth.password.label': 'पासवर्ड',
  'auth.submit': 'साइन इन गर्नुहोस्',
  'auth.activate': 'खाता सक्रिय गर्नुहोस्',

  'auth.error.identifierRequired': 'फोन वा इमेल प्रविष्ट गर्नुहोस्।',
  'auth.error.invalidEmail': 'मान्य इमेल ठेगाना प्रविष्ट गर्नुहोस्।',
  'auth.error.phoneSoon': 'फोनबाट साइन इन चाँडै उपलब्ध हुनेछ। अहिलेको लागि इमेल प्रयोग गर्नुहोस्।',
  'auth.error.passwordRequired': 'पासवर्ड प्रविष्ट गर्नुहोस्।',
  'auth.error.invalidCredentials': 'इमेल वा पासवर्ड मिलेन। कृपया फेरि प्रयास गर्नुहोस्।',
  'auth.error.tooManyAttempts': 'धेरै पटक प्रयास गरियो। केही मिनेट पर्खेर फेरि प्रयास गर्नुहोस्।',
  'auth.error.offline': 'सर्भरमा पुग्न सकिएन। इन्टरनेट जाँच गरेर फेरि प्रयास गर्नुहोस्।',
  'auth.error.validation': 'विवरण जाँच गरेर फेरि प्रयास गर्नुहोस्।',
  'auth.error.server': 'हाम्रो तर्फबाट समस्या आयो। कृपया फेरि प्रयास गर्नुहोस्।',
  'auth.error.storage': 'यो उपकरणमा सत्र सुरक्षित गर्न सकिएन। कृपया फेरि प्रयास गर्नुहोस्।',
  'auth.error.generic': 'साइन इन गर्न सकिएन। कृपया फेरि प्रयास गर्नुहोस्।',

  'activate.title': 'खाता सक्रिय गर्नुहोस्',
  'activate.body':
    'खाता सक्रिय गर्ने सुविधा चाँडै आउँदैछ। तपाईंको विद्यालयले दिएको सक्रियता कोड तयार राख्नुहोस्।',

  'auth.notice.sessionExpired': 'तपाईंको सत्र समाप्त भयो। कृपया फेरि साइन इन गर्नुहोस्।',

  'common.retry': 'फेरि प्रयास गर्नुहोस्',
  'common.signOut': 'साइन आउट',
  'common.loading': 'लोड हुँदैछ…',

  'context.error.title': 'तपाईंको खाता लोड गर्न सकिएन',
  'context.error.offline': 'सर्भरमा पुग्न सकिएन। इन्टरनेट जाँच गरेर फेरि प्रयास गर्नुहोस्।',
  'context.error.generic': 'केही समस्या आयो। कृपया फेरि प्रयास गर्नुहोस्।',

  'noSchool.title': 'कुनै विद्यालयमा पहुँच छैन',
  'noSchool.body':
    'तपाईंको खाता अहिलेसम्म कुनै विद्यालयसँग जोडिएको छैन। आफ्नो विद्यालयको प्रशासकलाई सम्पर्क गर्नुहोस्।',

  'picker.title': 'आफ्नो विद्यालय छान्नुहोस्',
  'picker.body': 'तपाईंले खोल्न चाहेको विद्यालय चयन गर्नुहोस्।',

  'useWeb.title': 'वेब एप प्रयोग गर्नुहोस्',
  'useWeb.body':
    'यस विद्यालयमा तपाईंको भूमिका मोबाइल एपमा उपलब्ध छैन। कृपया ZN School को वेब एप प्रयोग गर्नुहोस्।',

  'unavailable.title': 'विद्यालय उपलब्ध छैन',
  'unavailable.license':
    'यस विद्यालयको ZN School सेवा अहिले उपलब्ध छैन। कृपया आफ्नो विद्यालयलाई सम्पर्क गर्नुहोस्।',
  'unavailable.suspended':
    'यस विद्यालयको पहुँच निलम्बित वा अभिलेखित छ। कृपया आफ्नो विद्यालयलाई सम्पर्क गर्नुहोस्।',

  'shell.teacher': 'शिक्षक',
  'shell.guardian': 'अभिभावक',
  'shell.home': 'गृहपृष्ठ',
  'shell.placeholder': 'यस क्षेत्रका सुविधाहरू चाँडै आउँदैछन्।',
  'shell.school': 'विद्यालय',
  'shell.signedInAs': '{name} को रूपमा साइन इन',
  'shell.switchSchool': 'विद्यालय बदल्नुहोस्',
  'shell.switchTo': '{shell} मा जानुहोस्',
};
