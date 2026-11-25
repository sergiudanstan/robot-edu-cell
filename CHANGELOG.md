# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-25

First tagged release of the Robot Educational Cell digital twin as published at https://sergiudanstan.github.io/robot-edu-cell/: an LR Mate 200iD/4S moving ten cylinders between two Solitaire triangles, with program listing, I/O lamps, joint state and ceiling-camera view.

### Added
- `package.json` as the single version source, with `playwright-core` (test tooling only).
- Headless page smoke test (`node tests/smoke.mjs`) run in CI on every push and pull request.
- CI runs the existing logic tests (cycle logic checks; LR Mate link frames, spans and URDF chain against forward kinematics (fetches three.js from jsDelivr)), their negative probes, and a check that the committed `index.html` equals a fresh build from `src/`.
- CI, CodeQL, OpenSSF Scorecard and a tag-triggered release workflow with build
  provenance; Dependabot for actions and npm.
- `SECURITY.md`, `CONTRIBUTING.md` and this changelog.

[Unreleased]: https://github.com/sergiudanstan/robot-edu-cell/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sergiudanstan/robot-edu-cell/releases/tag/v0.1.0
