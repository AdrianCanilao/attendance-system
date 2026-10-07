# CIBO Attendance System — Codex / Team Development Rules

## Repository
- Repository: AdrianCanilao/attendance-system
- Primary development branch: `test-deployment`
- Production branch: `main`

## Git rules
- NEVER modify or push directly to `main`.
- Prefer a feature branch for every task.
- Do not rewrite shared branch history or force-push unless explicitly approved.
- Before starting work, inspect the current branch and relevant files.
- Keep changes focused on the assigned task.
- Do not revert another team member's work without understanding why it exists.
- Use Pull Requests for merging feature work into `test-deployment`.

## Current architecture
- Frontend: React + Vite
- Backend: FastAPI + Python
- Database: PostgreSQL through Supabase
- Authentication: Supabase Auth
- Storage: Supabase Storage
- Face recognition: InsightFace / ArcFace / buffalo_l
- Image processing: OpenCV
- Liveness/blink support: MediaPipe
- Kiosk: Raspberry Pi + camera
- Frontend deployment: Vercel
- Backend deployment: Render
- Email: Resend through Supabase Edge Function `notification-email`

## Roles
- HR
- Branch Supervisor
- Employee

Use **Branch Supervisor** in documentation and explanations. "Maintenance Specialist" is the older name for the same role and should not replace Branch Supervisor when referring to the current role.

## Important system rules
- HR creates and manages Branch Supervisors.
- Branch Supervisors create and manage Employees within their branch.
- Preserve branch restrictions and role restrictions.
- Kiosks are associated with branches through their registered device identity/token, not GPS.
- Current kiosk live attendance uses `X-Kiosk-Token`.
- Five failed attendance verification attempts trigger a five-minute lockout and email notification.
- Failed verification attempts are recorded in the HR Audit Trail.
- Web attendance and kiosk attendance are centralized in the same system.

## Authentication / secrets
- The frontend intentionally uses Supabase Auth with `persistSession: false`; do not re-enable persistent auth-token storage without approval.
- Never log or commit access tokens, refresh tokens, passwords, service-role keys, API keys, or .env secrets.
- Never put production credentials in source code, documentation, or chat.
- Do not disable Supabase Row Level Security just to make a feature work.
- Inspect existing RLS policies before changing database access.

## Face recognition terminology
- Do not describe ArcFace as manually measuring features such as nose width or jawline.
- Explain the pipeline as face detection/processing -> face representation (embedding) -> comparison -> identity decision.
- Do not claim recognition is perfect.
- InsightFace is the current recognition system. Avoid reintroducing obsolete recognition paths without reviewing the current architecture.

## Coding rules
1. Inspect before editing.
2. Identify all affected frontend/backend/database pieces.
3. Make the smallest safe change.
4. Preserve working behavior.
5. Do not redesign unrelated UI.
6. Consider RLS, authentication, branch restrictions, and API compatibility.
7. Test the affected workflow.
8. Report files changed, what changed, why, and what was tested.

## High-risk areas
Treat these carefully and request review before changing them when the task is not specifically about them:
- Supabase RLS and storage policies
- authentication/session handling
- kiosk authentication/device tokens
- attendance calculation
- face enrollment/recognition
- verification lockout
- production deployment configuration
- Resend/notification configuration

Known areas previously identified for security review include:
- `/upload-face`
- `/verify-face`
- verification-lock endpoints
- legacy kiosk endpoints
- publicly exposed InsightFace service endpoints

Do not automatically fix these while working on an unrelated feature.

## Attendance
Current web Time In/Time Out flow includes camera-based verification and may include location verification.
Overtime must be calculated from the applicable scheduled shift rather than blindly writing zero.
Do not assume every attendance rule is database-driven; inspect the actual implementation.

## Project stage
This is a working capstone nearing final presentation. Stability is more important than large refactors.
Do not perform broad refactors merely because the code could be cleaner.
Avoid changing unrelated features.

## Team workflow
Each member should work on an assigned feature branch, for example:
- `adrian/<feature>`
- `kenneth/<feature>`
- `josiah/<feature>`
- `villariez/<feature>`

Recommended flow:
feature branch -> commit -> Pull Request -> review -> `test-deployment` -> testing -> `main`

Adrian is the technical lead/integrator. Changes affecting multiple modules, authentication, database policies, deployment, or security should be reviewed by Adrian before merging.

## Do not guess
If documentation and code disagree, inspect the repository and report what the current code actually does. Do not invent endpoints, tables, policies, or features.
