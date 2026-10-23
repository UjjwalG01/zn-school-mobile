/** "Class 8 · A", or just "Class 6" for a class with no sections (ADR-0054). Shared by teacher features. */
export const placementLabel = (placement: { className: string; sectionName: string | null }) =>
  placement.sectionName ? `${placement.className} · ${placement.sectionName}` : placement.className;
