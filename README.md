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
git clone --branch v0.1.0 https://github.com/workrr-trust/certify.git
(cd certify && npm ci --ignore-scripts && npm run build)
node certify/dist/cli.js verify skills/csv-summary --bundle cert/certificate.sigstore.json
# or with the Go implementation:
(cd certify/go && go build -o ../../workrr-go ./cmd/workrr)
./workrr-go verify skills/csv-summary --bundle cert/certificate.sigstore.json
```

The first certificate was issued on 2026-10-19 and logged in public Rekor at
[log index 3325986274](https://search.sigstore.dev/?logIndex=3325986274).
