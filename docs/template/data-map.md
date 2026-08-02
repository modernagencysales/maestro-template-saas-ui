# App Idea Funnel Data Map

This map records the sensitive-data boundaries for the public app-idea funnel.
The complete retention and deletion posture lives in `data-lifecycle.md`.

| Data                         | Source                            | Durable destination                                             | Allowed consumers                                  | Explicitly excluded                                  |
| ---------------------------- | --------------------------------- | --------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| Anonymous access token       | founder browser                   | SHA-256 hash in `evaluationSessions`                            | evaluator/report ownership checks                  | logs, analytics, public shares, email                |
| Eight idea answers           | founder intake                    | `evaluationAnswers`                                             | evaluation and entitled Build Pack generation      | analytics, payment metadata, public-share joins      |
| Free report                  | decoded evaluator output          | `evaluationReports` plus append-only `evaluationReportVersions` | owner library/export and snapshot projector        | raw provider output                                  |
| Public report snapshot       | owner share action                | `evaluationShares.publicSnapshotJson` with hashed share token   | unauthenticated share query                        | private answers, session IDs, owner token, paid pack |
| Checkout identity            | server-created checkout           | `checkoutSessions`                                              | Dodo adapter and webhook reconciliation            | client-granted entitlement                           |
| Verified payment event       | signed Dodo webhook               | `purchases`, `buildPackEntitlements`, `maestroCredits`          | commerce ledger, generation gate, support          | idea text, prompts, model output, analytics payloads |
| Paid generation input/output | entitled workflow                 | `buildPacks`, `buildPackStages`                                 | pack viewer/export, support resume, Maestro mapper | free public share and unconsented analytics          |
| Support state                | failed paid stage/operator action | `supportIncidents`                                              | authorized support resume controls                 | a new purchase requirement                           |

The free model receives one bounded structured request without research or
tools. The premium model pipeline is a separate eight-stage workflow. Both tiers
decode untrusted model output before persistence, and operational events carry
only allowlisted identifiers, verdict/status enums, durations, call counts, and
estimated cost.
