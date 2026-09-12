# Operational backend feature specification

Status: unified chat model; latest user clarification supersedes the former independent AI lookup design; see README for startup, tests, and external AI configuration.

## Confirmed constraints

- Backend: Python with FastAPI.
- Scope: users, claims, claim conversations, assignments, operator feedback.
- Statistics belong to a separate service.
- Schema improvements are authorized. Migrations 001–003 form the fresh baseline; incremental 004 upgrades existing local claims without resetting data.
- Adapt the frontend to supported database fields and behavior.
- Deliver a runnable, persisted hackathon workflow with authentication and server-side permissions.
- Working branch: `feat/fastapi-operational`, originally combining frontend commit `2481d01` and schema commit `c5d24f7`; the schema is now revised on this branch.

## Accepted features

### Accounts

- Optional local-only top-menu «Демо» switches between dedicated persistent Admin, L1, L2, L3, and Consumer test accounts. It uses real backend sessions and permissions, not frontend role impersonation; disabled by default via `DEMO_ACCOUNTS=false`.

- Public registration with username and password; registration always creates a normal user.
- `users.name` is the username; no separate display name or email identity.
- Login, logout, current authenticated profile, and changing one's own password.
- Administrator creates support accounts with an initial password and manages their support level.
- Preserve `supportL1`, `supportL2`, and `supportL3`; each works only its matching support queue. Staff may read other levels’ claim history but may not handle those claims.
- User directory and support-account management are administrator features.
- No email recovery, Госуслуги integration, account activation/deactivation, or account deletion in v1.
- Administrators can reset passwords for normal users and support accounts; the new password is communicated outside the application.
- Changing or resetting a password invalidates all existing sessions for that account.
- Administrative account recovery is a deployment procedure, not a public recovery flow.

### Claims and queues

- One chat form creates one claim from the initial question, followed by one server-authored AI answer.
- Persist the question and answer before returning success; no separate support-creation form or quoted/imported AI answer.
- Support claim listing, detail views, search, and status/category/operator filtering.
- Users can access only their own claims; support queues are restricted to their level, with read-only history accessible by claim ID; administrators can access all claims.
- Retain the frontend's six categories in `claims.topic`: `TECHNICAL`, `DOCUMENTS`, `PROCUREMENT`, `ACCOUNT`, `CONTRACT`, and `OTHER`.
- New chats default to OTHER; the API can accept one of the six categories. There is no separate title/category form. The first question supplies the title.
- Assigned support or an administrator may correct the category and optionally set a free-text `subtopic` while the claim is active.
- Claim authorship is determined from authentication, never a caller-supplied user ID.

### Claim message threads

- Persist text messages within a claim.
- AI answers only the first question. Follow-up messages remain in the same claim and never call AI again. There is no separate conversation entity.
- Messages are immutable: no editing, deletion, or attachments.
- The claim author can send messages while the claim is active.
- Only the assigned support operator or an administrator can send staff replies.
- An unassigned support operator may take a claim and send the first reply atomically.
- Automatically refresh the open conversation view to show new replies; transport and interval are implementation details.
- Terminal claims retain readable history but accept no new messages.
- Message author identity comes from the authenticated account.

### Unified AI → L1 → L2 → L3 chat

- The first question creates a claim at handling_level=0 (AI). The backend calls AiService.ask(question) once and persists its answer and sources as an AI message.
- Automatic AI routing: an ESCALATED ML result moves the claim directly to its classified L1/L2/L3 queue, with a persisted decision and system confirmation. Successful AI answers do not close claims.
- AI → L1, if not already handed off: the claim author dislikes the AI message, or sends any follow-up message. This atomically moves the same claim to the unassigned L1 queue and adds a system handoff message.
- Subsequent user messages and repeated AI dislikes do not advance support levels.
- L1 → L2 and L2 → L3: only the assigned matching-level support operator presses «Эскалировать». Each step releases assignment, clears assigned_at, sets NEW, and adds a system message. L3 is final.
- Escalation requests include expected_level; concurrent/retried requests cannot skip levels. Claims and messages are never copied or replaced.
- If AI fails or is unconfigured, preserve the question and a system availability notice at AI level. A follow-up still transfers it to L1. Never silently invent an answer or automatically escalate on service failure.
- Model/RAG implementation runs in an isolated ML service; the local profile uses Qwen3, E5 and Qdrant. AI_MODE=mock selects the labelled MockAiService class; all operational data remains real. HTTP mode never falls back to mock.
- Claim creation accepts a request_id UUID scoped to its author. Repeating the same creation request returns the existing claim without another AI call. The UI reuses the key when retrying after a network error.

### Assignments and permissions

- A claim has at most one current operator.
- `claims.operator_id` is a nullable scalar foreign key for the current operator; previous assignments are captured in claim events.
- Support can take an unassigned active claim at its own level, never one still handled by AI.
- Taking a new claim moves it to `IN WORK`.
- The first support reply may perform taking, status change, and message insertion as one atomic operation.
- Administrators can reassign active human-handled claims only to a support account at the current level; reassignment cannot skip tiers. Changing an employee’s support level is rejected while they own active claims.
- Assigned support and administrators may change operational status subject to the lifecycle below.
- Multiple simultaneous operators and an assignment-history UI are excluded; claim events capture assignments and handoffs for later reporting.

### Lifecycle

| Starting state | Action | Actor | Result |
| --- | --- | --- | --- |
| No claim | Initial question and AI answer | User / AI service | `NEW`, AI level |
| AI level | ML detects escalation | ML decision / backend | `NEW`, unassigned detected L1/L2/L3 |
| AI level | Dislike AI answer or send follow-up | Claim author | `NEW`, unassigned L1 |
| L1/L2, `IN WORK` | Escalate | Assigned operator | `NEW`, unassigned next level |
| `NEW`, L1–L3 | Take/assign | Matching-level support or administrator | `IN WORK` |
| `IN WORK` | Reassign | Administrator | `IN WORK`, new operator |
| `IN WORK` | Resolve | Assigned operator or administrator | `DONE` |
| `NEW` or `IN WORK` | Cancel | Claim author | `CANCELLED` |

- `DONE` and `CANCELLED` are terminal; no reopening or further operational edits.
- A new issue requires a new claim.
- Feedback submission/editing is the explicit exception to terminal read-only behavior.
- Do not equate the old frontend `CLOSED` status with cancellation.

### Operator feedback

- Feedback evaluates the assigned operator's handling of a completed claim, not an AI answer.
- Only the claim author may submit or edit feedback, and only when the claim is `DONE`.
- Allow one editable rating per claim and assigned operator.
- Rating is thumbs-up or thumbs-down.
- A negative rating requires at least one existing reason code: `SLOW WORK`, `INCORRECT ANSWER`, `IRRELEVANT ANSWER`, or `RUDE BEHAVIOUR`.
- Positive ratings have no reasons.
- No free-text reviews, rating deletion, or rating edit history. AI-message dislikes are separate from operator ratings and trigger the AI handoff.
- Feedback does not reopen or otherwise change the claim.

## Frontend adaptations

- Preserve the original frontend page layouts, sidebar/header, visual components, and navigation; integrate through its services/repositories, not a parallel replacement application.
- Keep analytics navigation with an explicit unavailable state until its separate service is connected. Disable unsupported settings, notifications, and attachments; hide the priority-based control queue in API mode.
- Label hardcoded sidebar questions as examples, not recent history. Show «Не помогло» on the AI answer and show the current handling level.

- Replace email-based account forms with username-based forms.
- Replace frontend ticket statuses with the database lifecycle and actor-specific actions.
- Remove unsupported priority controls and the priority-based control queue.
- Remove organization, INN, email, phone, active-status, and last-login fields that cannot be persisted.
- Expose all three support levels in administrator forms.
- Keep only one current operator in assignment views.
- Add operator feedback to completed claim views.
- Add category/subtopic correction for assigned support and administrators on active claims.
- Add administrator password-reset controls for users and support accounts, and password-change controls for the authenticated user.
- Use one persistent thread, from the AI answer through all support replies; no standalone /ai/ask endpoint or direct support form.
- Hide or clearly mark deferred features; API mode must not silently present mocked data as real service results.
- Preserve the separation between the operational backend and statistics service.

## Persistence and correctness requirements

- Claim creation and its first message succeed or fail together.
- Simultaneous attempts to take one claim cannot create multiple owners or unauthorized replies.
- Terminal-state checks, assignment checks, and writes must remain correct under concurrent requests.
- Database unique constraints enforce case-insensitive usernames and one rating per claim/operator.
- Persist sessions with hashed tokens, expiry, and revocation. Password changes increment the account credential version and revoke existing sessions; authentication checks both across instances.
- Never trust request-supplied author names, roles, user IDs, or claimed AI identity as authentication.
- Messages reference claims directly through `claim_id` and have an author kind plus a nullable human-author foreign key; do not encode sender metadata in message text.
- Store claim creation/update, assignment, resolution, and cancellation timestamps and automatic claim-change snapshots. Attribute changes using authenticated transaction-local actor context.
- There is no separate conversation table. One reactions table stores both AI-message feedback (target_kind=AI_MESSAGE, message_id) and final-operator ratings (target_kind=OPERATOR, operator_id). Targets are mutually exclusive; author ownership and uniqueness are enforced.

## Deferred scope

- Analytics/statistics implementation in this service.
- Attachments, message editing/deletion, notifications, priority/SLA workflows, settings persistence, and an audit-history UI.
- Email/organization/INN profiles, account deactivation/deletion, email recovery, and Госуслуги.
- Multi-turn AI generation is excluded: after the first answer, humans continue the same chat.
- AI engine/model/RAG implementation; only integration with a separately supplied service is in scope.

## Acceptance scenarios

1. Register, log in, create a claim with a first message, and see it after refresh.
2. A different normal user cannot list, read, message, cancel, or rate that claim.
3. Support takes a claim; it becomes `IN WORK` and records one current operator.
4. Competing first replies cannot bypass ownership or create multiple operators.
5. User and assigned support exchange text messages; another support operator can read but cannot reply or resolve it.
6. An administrator reassigns the claim; the previous operator loses write access.
7. Assigned support resolves the claim; the user can read it and submit/edit operator feedback, but neither party can append messages or reopen it.
8. The claim author cancels an active claim; it remains readable, accepts no messages, and cannot receive completion feedback.
9. An administrator creates a support account; that account can log in and change its password.
10. Data persists across application restarts using the new baseline schema.
11. An administrator resets a user or support password; the old password and all previous sessions cease to work, and the new password permits login.
12. A user changes their password; existing sessions are invalidated and the new password permits login.
13. New chats default to OTHER; assigned support/admin can correct it and set an optional subtopic while the claim is active, but cannot reclassify a terminal claim.
14. AI dislikes and follow-ups both hand off to L1 with the original claim ID, question, answer, and sources intact after refresh.
15. Unavailable AI persists the question and an availability notice; a follow-up reaches L1 without another form.
16. Only assigned matching-level operators can escalate one tier at a time; L3 has no escalation action.
17. Simultaneous dislike/follow-up, repeated escalation, and retried initial creation cannot skip levels or duplicate the initial AI response.
18. Migration 004 preserves existing claims, messages, timestamps, assignments, and audit events; existing queued claims become L1, assigned claims retain their operator’s tier.

## Decision record

Latest clarification: AI and support are one entity and one chat. This explicitly supersedes independent temporary AI lookups, quoted-answer imports, direct support creation, and equal operational permissions across support levels. Username accounts, immutable history, terminal resolution/cancellation, operator ratings, original frontend layouts, and separate statistics remain unchanged.

## Shared reaction UX and contract

AI and operator ratings use the same ReactionForm, ReactionInput validation, Reaction response, and reactions persistence. Both send `{like, reasons}`: positive ratings have no reasons; negative ratings require one or more unique values from the same four reason codes. Both can be changed between positive and negative while feedback is available. Submitting an AI dislike, not merely selecting its emoji, performs AI → L1. Likes never escalate; editing feedback never reverses an existing handoff. AI feedback is available on active claims; final-operator feedback after resolution.
