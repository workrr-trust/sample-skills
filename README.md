# workrr-trust/sample-skills

A sample agent skill certified by the public [Workrr certifier](https://github.com/workrr-trust/certify).

- `skills/csv-summary/` — a small `SKILL.md` skill with a deterministic test suite
  (`workrr.json` → `node check.cjs`).
- `.github/workflows/workrr.yml` — calls
  `workrr-trust/certify/.github/workflows/certify.yml@v0.1.0` on every push to `main`.

Each run uploads a `workrr-certificate` artifact (a Sigstore bundle, logged in public
Rekor). To verify it yourself, without trusting Workrr:

```bash
gh run download --repo workrr-trust/sample-skills -n workrr-certificate -D cert
npx @workrr-trust/certify verify skills/csv-summary --bundle cert/certificate.sigstore.json
# or the Go binary: go install github.com/workrr-trust/certify/go/cmd/workrr@latest
```

The first certificate was issued on 2026-10-19 and logged in public Rekor at
[log index 3325986274](https://search.sigstore.dev/?logIndex=3325986274).
