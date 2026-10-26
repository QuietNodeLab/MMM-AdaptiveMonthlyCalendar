# Migration notes

This candidate is a separately named upstream derivative. It does not replace or
update an installed MMM-MonthlyCalendar automatically. Keep a running
installation unchanged until a separate, explicit migration is planned.

- Module registration, directory and CSS scope are MMM-AdaptiveMonthlyCalendar.
- The CALENDAR_EVENTS contract is retained; notification objects are now copied.
- All-day ends remain exclusive on input. Timed midnight ends do not add an
  extra cell, while timed events ending later in the morning keep their last
  date.
- Embedded title/color/calendar policies are removed. Explicit priorityRules and
  compactTitleRules are optional; an empty rule list preserves chronology.
- Standalone height/width and adaptive-row options replace dashboard geometry.
- Overflow uses a native dialog. No dashboard CSS or global overlay theme is
  needed.
- Calendar defaults remain English-compatible with global MagicMirror
  locale/time formatting. Display/broadcaster timezone alignment is still
  required.
- Week-number code was replaced; original upstream license/attribution is
  retained.

Use synthetic feeds and a disposable runtime for evaluation. The local candidate
has no source-project history and includes no real calendar data or old
screenshot.
