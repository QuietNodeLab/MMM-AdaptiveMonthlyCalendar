# Upstream attribution and adaptation

This is an upstream-derived community candidate, not an official upstream
release.

- Original project: https://github.com/kolbyjack/MMM-MonthlyCalendar.git
- Pinned upstream commit: `dadcd2c188daf305b45065fc17dfb1f250ac2e59`
- Original license: MIT, preserved verbatim in LICENSE-UPSTREAM.
- The candidate LICENSE preserves that upstream notice and adds contributor
  attribution for the additional MIT changes.

The renderer and original calendar behavior remain derived from Jonathan Kolb's
MMM-MonthlyCalendar. The adaptive layout has been separated into a standalone
helper and stylesheet. Embedded calendar/color/title identities have been
replaced with configuration rules. Notification normalization now copies input
objects, respects exclusive all-day ends and retains timed events' final
calendar dates. Month switching from the 31st and day-change refresh are covered
separately.

The pinned upstream renderer referenced a Stack Overflow week-number answer at
https://stackoverflow.com/a/6117889/245795 . That function is not included in
this candidate: it has been replaced by an independently expressed ISO-week
calculation using Monday ordinals and the January 4 rule, with boundary
regression tests. The legacy reference is retained here as provenance rather
than claiming its code as new original work.

No upstream screenshot or live calendar data is bundled. Rendering/style changes
are not represented as pixel-identical to any existing production dashboard.

MagicMirror² is a separate runtime dependency:
https://github.com/MagicMirrorOrg/MagicMirror . Its source, dependencies and
icon fonts are not bundled here. Documentation screenshots use synthetic data
and the test system's font renderer. Source-project history and account
identifiers are not included in the candidate archives. No fork has been
published or upstream PR submitted as part of preparation.
