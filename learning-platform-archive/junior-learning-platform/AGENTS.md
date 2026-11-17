# Project boundaries

- This is an independent local-only MVP. Never deploy, push, access remote D1/R2, or run scripts from the adjacent math repository.
- Preserve existing work. Before changes, inspect git status. No remote has been configured.
- Public assets ONLY belong in public/. Backend, migrations, answers, secrets and student data must never be served as static files.
- API v1 and docs/openapi.json are the Antigravity integration boundary. Coordinate incompatible contract changes before implementation.
- src/ and migrations/: backend ownership; public/: frontend ownership; docs/: shared contract. No need to start another agent automatically.
- No AI/OCR fallbacks that fabricate student work. All seed content starts pending human review. Test approvals are simulated actors, not evidence of actual teacher verification.
- Verify with node scripts/check.mjs and node --test tests/*.test.mjs. Node 24+ is required.
- Every new persistable business surface MUST be added to public/export-registry.js and docs/EXPORT-INVENTORY.md with visible PDF + print actions, real authorized data, preview, empty/error/loading handling and desktop/mobile/A4 checks. Do not remove existing data export formats. Buttons alone are not implementation.
- Follow docs/THEWYJ-AUDIT.md for actual upstream patterns. Do not silently import broad membership/admin access or cache student API/file responses. Keep reuse provenance and third-party licenses per docs/ARCHITECTURE.md.
