# Security evidence (project environment)

| File | Purpose |
| --- | --- |
| `npm-audit-date.txt` | Timestamp of the latest `npm audit` run in this tree |
| `npm-audit-latest.txt` | Human-readable audit summary |
| `npm-audit-latest.json` | Machine-readable audit output |

Re-run before submission or review:

```bash
npm audit > security/npm-audit-latest.txt
npm audit --json > security/npm-audit-latest.json
date > security/npm-audit-date.txt
```

This snapshot supports dependency findings in the security reports. It is point-in-time evidence, not a claim that the product stays free of future advisories.
