# Agron Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Verified Identity Required**: No read or write is allowed unless `request.auth != null && request.auth.token.email_verified == true`.
2. **PII Isolation (`/users/{userId}`)**: User profile documents contain email and display name PII and are strictly readable (`get`) and writable (`create`, `update`) ONLY by `request.auth.uid == userId`. Collection `list` on `/users` is completely denied.
3. **Master Gate (`/users/{userId}/threads/{threadId}` and `/users/{userId}/crops/{cropId}`)**: No subcollection document can be created or updated unless the parent `/users/{userId}` document exists and `ownerId == request.auth.uid == userId`.
4. **Immutable Ownership & Timestamps**: `uid`, `id`, `ownerId`, and `createdAt` cannot be modified after creation. `createdAt` must equal `request.time` on create; `updatedAt` must equal `request.time` on create and update.
5. **Bounded Arrays & Strict Keys**: Every document enforces `keys().hasAll(...)` and `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update, string `.size()` limits, ID regex `'^[a-zA-Z0-9_\\-]+$'`, and bounded arrays (`messages.size() <= 50`, `logs.size() <= 30`).

## 2. "Dirty Dozen" Adversarial Payloads (Must All Return `PERMISSION_DENIED`)
1. **Unauthenticated read**: `get /users/u1` with `auth == null`.
2. **Unverified email write**: `set /users/u1` with `auth = { uid: 'u1', token: { email_verified: false } }`.
3. **Cross-user PII read**: `get /users/u1` signed in as `u2`.
4. **Users collection list scraping**: `list /users` signed in as `u1`.
5. **Shadow / Ghost field injection on profile**: `set /users/u1` including extra field `isAdmin: true`.
6. **ID poisoning (>128 chars or invalid chars)**: `set /users/u1/threads/${'a'.repeat(130)}`.
7. **Orphaned subcollection write (missing parent `/users/u1`)**: `set /users/u1/threads/t1` before `/users/u1` exists.
8. **Identity spoofing in thread**: `set /users/u1/threads/t1` with `ownerId: 'u2'` while signed in as `u1`.
9. **Client-forged timestamp**: `set /users/u1/crops/c1` with `createdAt: Timestamp(2020-01-01)`.
10. **Immutable owner mutation on update**: `update /users/u1/crops/c1` changing `ownerId: 'u2'`.
11. **Oversized message array (>50 items)**: `set /users/u1/threads/t1` with 51 messages.
12. **Terminal stage update reversal**: Attempting to update `/users/u1/crops/c1` after `stage == 'sent-to-market'`.
