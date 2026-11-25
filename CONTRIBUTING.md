# Contributing

Contributions are welcome. This is a single-maintainer project, so please open an issue
before starting anything substantial.

**Security problems do not belong in issues.** Follow [SECURITY.md](SECURITY.md).

## Branches, pull requests and releases

- `main` is the only long-lived branch and is protected: changes land through a pull
  request with the required checks green, commits on `main` are signed, and force-pushes
  are refused. Pull requests are squash-merged; GitHub deletes the branch on merge.
- Branch names: `<type>/<topic>` (`feat/`, `fix/`, `docs/`, `chore/`, `release/`);
  agents use `agent/<name>/<topic>`.
- A release is a pull request that bumps `version` in `package.json` and moves
  `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) to a dated version. After it merges, a
  signed `vX.Y.Z` tag on that commit triggers `release.yml`, which refuses to run if the
  tag, `package.json` and the changelog disagree. Tags are never moved or deleted.

## Running it locally

`index.html` is generated: edit `src/page.html` and `src/js/*.js`, never `index.html`
itself, then rebuild and commit both. CI fails if the committed `index.html` differs from
a fresh build.

```bash
python3 -m http.server     # then open http://localhost:8000/
node tools/build.mjs       # rebuild index.html from src/
node tests/run.mjs
node tests/robot_geometry.mjs
npm ci && node tests/smoke.mjs   # headless page smoke test (needs Google Chrome installed)
```

Each negative probe must exit 1 (exit 2 means the probe itself is ineffective); CI runs
them too:

```bash
node tests/run.mjs --perturb
node tests/run.mjs --perturb2
node tests/robot_geometry.mjs --perturb
```

Use `PW_CHANNEL=chromium` for the smoke test if you installed Playwright's own Chromium
instead of Chrome.
