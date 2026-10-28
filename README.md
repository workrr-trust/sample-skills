# workrr-trust/sample-skills

[![workrr certified](https://trust.workrr.ai/badge/workrr-trust/sample-skills.svg)](https://trust.workrr.ai/ledger/?repo=workrr-trust/sample-skills)

A sample agent skill certified by the public [workrr certifier](https://github.com/workrr-trust/certify).

- `skills/csv-summary/` — an RFC 4180 CSV profiler `SKILL.md` skill with a deterministic
  42-test suite (`workrr.json` → `node check.cjs`, `42/42 checks pass`).
- `skills/pdf-extract/` — a PDF stream, metadata, and table extraction `SKILL.md` skill
  with a deterministic 42-test suite (`workrr.json` → `node check.cjs`, `42/42 checks pass`).
- `.github/workflows/workrr.yml` — calls
  `workrr-trust/certify/.github/workflows/certify.yml@v0.1.7` on every push to `main`,
  then starts the GitLab witness for the same commit and stores its certificate in this
  repository's attestation store. Two forges agreeing is the level **Reproduced**.

Both certificates are Sigstore bundles logged in public Rekor. To verify them yourself,
without trusting workrr:

```bash
digest=$(npx -y @workrr-trust/certify digest skills/csv-summary | cut -d' ' -f1)
gh api "repos/workrr-trust/sample-skills/attestations/$digest" --jq '.attestations[].bundle' | split -l 1 - bundle-
npx @workrr-trust/certify verify skills/csv-summary $(printf -- '--bundle %s ' bundle-*)
# or the Go binary: go install github.com/workrr-trust/certify/go/cmd/workrr@latest
```

The first certificate was issued on 2026-10-19 and logged in public Rekor at
[log index 3325986274](https://search.sigstore.dev/?logIndex=3325986274).
