# Local candidate validation

Tested with Node 24.19.0, the pinned MagicMirror 2.38.0 runtime, and Chromium on Linux.

- npm ci --ignore-scripts, runtime JavaScript syntax and CSS brace checks passed.
- Nine unit tests cover deep input snapshots, exclusive all-day ends, invalid
  intervals, timed final mornings/midnight ends, explicit priorities, row budgets,
  ISO-week boundaries, filtering and deduplication.
- Seven browser cases passed: dense five- and six-week months; priority retention;
  overflow counts, fitting bounds, native-dialog Close/Escape and resizing; actual
  winter and spring-DST ICS ingestion; previous/next month from the 31st; and
  non-adaptive priority ordering with scrollable content.
- Actual synthetic ICS is fetched only from an ephemeral loopback fixture server
  through the pinned upstream CalendarFetcher and parser in a New York process.
- A separate disposable MagicMirror startup loaded both new candidates, received
  synthetic calendar notifications through the real module bus, rendered dense
  overflow, and reported no browser errors. A loopback stripped-prefix proxy was
  used; the pinned core also needs its root Socket.IO client asset forwarded.
- Documentation screenshots contain only synthetic events. No source screenshot,
  live calendar feed, external API, private data or production CSS was used.

The candidate was privacy-scanned and includes original upstream MIT notices,
explicit derivation/provenance, and no source-project Git history. Fresh ZIP
extraction, npm ci and the unit suite are checked before handoff.

## Remaining limits

Other runtime versions, physical displays, Docker/Electron startup, Windows/macOS,
assistive technology and prolonged unattended use remain unverified. This is not a
pixel-equivalence test against a production dashboard. No upstream PR, remote
repository, release or device deployment has been created by this preparation.
