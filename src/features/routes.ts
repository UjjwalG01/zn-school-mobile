import type { Href } from 'expo-router';

/**
 * expo-router file name of a feature's tab: the id minus its audience prefix, with `home` → `index`
 * (`teacher.home` → `index`, `teacher.attendance` → `attendance`). Each registered tab feature needs
 * `app/<audience>/<routeName>.tsx` (or a directory with an `index`); the registry stays the only list
 * of features.
 */
export function routeName(featureId: string): string {
  const name = featureId.split('.').slice(1).join('.');
  return name === 'home' || name === '' ? 'index' : name;
}

/**
 * Where a `menu` feature opens: inside the directory of the tab that lists it
 * (`teacher.assignments` in tab `teacher.academic` → `/teacher/academic/assignments`). The cast is the
 * one place a registry-derived path meets expo-router's typed routes.
 */
export function menuHref(feature: { id: string; tab?: string }): Href {
  const [audience = ''] = feature.id.split('.');
  return `/${audience}/${routeName(feature.tab ?? feature.id)}/${routeName(feature.id)}` as Href;
}
