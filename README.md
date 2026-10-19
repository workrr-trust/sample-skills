# workrr-trust/sample-skills

A sample agent skill certified by the public [Workrr certifier](https://github.com/workrr-trust/certify).

- `skills/csv-summary/` — a small `SKILL.md` skill with a deterministic test suite
  (`workrr.json` → `node check.cjs`).
- `.github/workflows/workrr.yml` — calls
  `workrr-trust/certify/.github/workflows/certify.yml@v0.1.0` on every push to `main`.

Each run uploads a `workrr-certificate` artifact (a Sigstore bundle, logged in public
Rekor). To verify it yourself, without trusting Workrr:

```bash
gh run download --repo workrr-trust/sample-skills -n workrr-certificate
npx github:workrr-trust/certify#v0.1.0 verify skills/csv-summary --bundle certificate.sigstore.json
```
