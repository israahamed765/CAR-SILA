# Security evidence (project environment)

| File | Purpose |
| --- | --- |
| `npm-audit-date.txt` | Timestamp of the latest `npm audit` run in this tree |
| `npm-audit-latest.txt` | Human-readable audit summary |
| `npm-audit-latest.json` | Machine-readable audit output |
| `deep-audit.mjs` | Scripted live checks: CSRF, enumeration signals, error leakage |
| `deep-audit-results.json` | Last deep-audit raw results |
| `deep-audit-date.txt` | Summary + timestamp of the last deep audit |

Re-run before submission or review:

```bash
npm audit > security/npm-audit-latest.txt
npm audit --json > security/npm-audit-latest.json
date > security/npm-audit-date.txt
node security/deep-audit.mjs
```

These snapshots support findings in the security reports. They are point-in-time evidence, not a claim that the product stays free of future issues.
