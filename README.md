# workrr-trust/sample-skills

[![workrr certified](https://trust.workrr.ai/badge/workrr-trust/sample-skills.svg)](https://trust.workrr.ai/ledger/?repo=workrr-trust/sample-skills)

A sample agent skill certified by the public [workrr certifier](https://github.com/workrr-trust/certify).

- `skills/csv-summary/` — an RFC 4180 CSV profiler `SKILL.md` skill with a deterministic
  42-test suite (`workrr.json` → `node check.cjs`, `42/42 checks pass`).
- `skills/pdf-extract/` — a PDF stream, metadata, and table extraction `SKILL.md` skill
  with a deterministic 42-test suite (`workrr.json` → `node check.cjs`, `42/42 checks pass`).
- `.github/workflows/workrr.yml` — calls
  `workrr-trust/certify/.github/workflows/certify.yml@v0.1.1` on every push to `main`.

Each run uploads a `workrr-certificate` artifact (a Sigstore bundle, logged in public
Rekor). To verify it yourself, without trusting workrr:

```bash
gh run download --repo workrr-trust/sample-skills -n workrr-certificate -D cert
npx @workrr-trust/certify verify skills/csv-summary --bundle cert/certificate.sigstore.json
# or the Go binary: go install github.com/workrr-trust/certify/go/cmd/workrr@latest
```

The first certificate was issued on 2026-10-19 and logged in public Rekor at
[log index 3325986274](https://search.sigstore.dev/?logIndex=3325986274).
