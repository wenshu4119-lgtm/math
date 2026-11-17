
## Completed learning time plan release (2026-11-15)

The scoped time-plan upgrade is published as production-20261115.2, Worker 311ea4d4-3334-4221-8e65-b8fa1174b1f2, backend 20261115-plan-1. This release window is complete; no pending automatic production changes. Read release/TIME-PLAN-PRODUCTION-REPORT.md and release/time-plan-import-manifest.json before further changes. Recheck actual deployment and arrange a new single-publisher window before any next update. The self-study-loop content expansion remains paused and was not merged. Android stays paused; payment, real referral campaigns, WeCom integration and automatic messages stay closed. Original 54 tables and all existing uncommitted work preserved; normal traffic and backups continue.

# Independent trial release boundary

## Completed referral simulation release (2026-11-15)

The scoped parent-sharing/referral-simulation release is complete as `production-20261115.1` (Worker `c3439ffc-a4bd-4601-bad6-0ebf3a0a9f54`, backend `20261115-referral-1`). This chat and its subagents have no pending automatic production mutations. Normal user activity and scheduled backups continue. Real referrals, paid promotion, payments/payouts/transfers, automatic messages and enterprise-WeChat integration remain server-side closed; administrator contact inputs are private drafts only. Read `release/referral-production.json` and `release/REFERRAL-PRODUCTION-REPORT.md` before any later change. Recheck current deployment and coordinate a new single-publisher window; do not resume older publication tasks without coordination. All old work and additive referral records must be preserved.

## Active deployment handoff (2026-11-15; supersedes earlier ownership)

After verifying the user's new parent-sharing/referral-simulator task and their explicit authorization to coordinate publication, chat `01a1d9d6-b061-7262-b050-db8d03178f11` has stopped its source/deployment/production mutation work and handed the next scoped release to chat `01a1da0f-f500-7b23-9209-f578f3e46705` as the sole publisher. All subagents from the former owner are idle. Normal site traffic and scheduled backups remain running; this is not a database write-stop or maintenance window.

The handoff covers only the first neutral public experience and explicitly isolated simulated referral ledger. Real payment, payout, commission activities, paid promotion, automatic messages and enterprise-WeChat integration remain unconfirmed and must stay server-side closed. No real customer/student data may be used as simulation fixtures. Implement in the isolated `referral-partner-module` workspace, then merge reviewed deltas into the latest release; never overwrite the live project with an old snapshot.

Current verified baseline is `production-20261114.4`, Worker `6d6d98c5-bc71-4ffa-8b41-f4c7839b08fd`, backend `/opt/learning-platform/releases/20261114-arts-1`. Preserve all uncommitted work, junior/arts separation, DeepTutor, old math and VPS proxies. Recheck the actual baseline and obtain a fresh encrypted backup plus independent restore/migration checks before publishing. New migration 0030 is reserved for the isolated referral demo. Android remains paused. See `release/ownership-handoff-20261115.json` for inspection limits and `docs/REFERRAL-PUBLISH-HANDOFF-20261115.md` for the concrete boundary. The former owner must coordinate a new handoff before resuming any write or deployment task.

## Consolidated ownership (2026-11-14)

The user explicitly authorized chat `01a1d9d6-b061-7262-b050-db8d03178f11` to own question-bank integration, DeepTutor, the public homepage, and phased production deployment. Both previous implementation/release chats acknowledged freezing writes and deployment. This supersedes the historical stage-9 ownership restriction below for this task. Preserve all prior uncommitted work and old math, VPS proxy, accounts, and production records. Only the root agent deploys; bounded agents work on assigned files. Difficulty for both knowledge and questions is 超低 / 低 / 中等 / 高 / 超高; purpose is separate, unknown difficulty remains unclassified. Never manufacture a human review.

User authorized an independent website trial and Android preparation on 2026-11-14.
This directory owns public/, release/, android/, tests for release integration, and deployment configuration.
The source platform and Antigravity directories are read-only. Never run old math hooks or deploy its Worker.
Backend src/ and migrations/ are versioned snapshots owned by the original Codex chat. Stage 8 was explicitly handed off and is imported only after checking release/stage8-import.json hashes. Do not implement or modify AI backend work; stage 9 remains with the original chat.
No real student data, credentials in Git/static assets, automatic teacher approvals in the trial organization, new billing agreement, account registration or SDK license acceptance.
Only public/ may be served. Preserve the original 25 export kinds and integrate the four authorized stage 8 kinds with the same permission checks. User has paused Android and registration; work on the website only.
