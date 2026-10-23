import { t } from '../i18n';
import { type CalendarPreference, formatAlternateDate, formatDate, shiftIsoDate } from '../lib/date';
import { Stepper } from './Stepper';

export interface DateStepperProps {
  /** Canonical AD `YYYY-MM-DD`. */
  value: string;
  /** Inclusive bounds, also AD `YYYY-MM-DD`; the arrows disable at the edges. */
  min: string;
  max: string;
  /** The tenant's calendar; until it is known the canonical AD date is shown. */
  calendar: CalendarPreference | undefined;
  onChange: (iso: string) => void;
}

/** Previous / next day with the date in the tenant's calendar (the other calendar beside it, muted). */
export function DateStepper({ value, min, max, calendar, onChange }: DateStepperProps) {
  return (
    <Stepper
      label={calendar ? formatDate(value, calendar) : value}
      sublabel={calendar ? formatAlternateDate(value, calendar) : null}
      previousLabel={t('common.previousDay')}
      nextLabel={t('common.nextDay')}
      canGoBack={value > min}
      canGoForward={value < max}
      onPrevious={() => onChange(shiftIsoDate(value, -1))}
      onNext={() => onChange(shiftIsoDate(value, 1))}
    />
  );
}
