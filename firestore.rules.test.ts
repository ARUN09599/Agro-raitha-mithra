// Security specification verification cases matching security_spec.md "Dirty Dozen"
// Intended for execution against a Firestore Rules Emulator when available.

export interface DirtyPayloadCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  authUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyPayloadCase[] = [
  {
    id: 1,
    name: 'Unauthenticated profile read',
    operation: 'get',
    path: 'users/user_1',
    authUid: null,
    emailVerified: false,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email profile create',
    operation: 'create',
    path: 'users/user_1',
    authUid: 'user_1',
    emailVerified: false,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-user PII profile read',
    operation: 'get',
    path: 'users/user_1',
    authUid: 'user_2',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Users collection list scraping',
    operation: 'list',
    path: 'users',
    authUid: 'user_1',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow field isAdmin injection',
    operation: 'create',
    path: 'users/user_1',
    authUid: 'user_1',
    emailVerified: true,
    payload: { isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Path variable ID poisoning (>128 chars)',
    operation: 'create',
    path: `users/user_1/threads/${'a'.repeat(130)}`,
    authUid: 'user_1',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned thread create without parent user document',
    operation: 'create',
    path: 'users/user_1/threads/thread_1',
    authUid: 'user_1',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Owner identity spoofing on thread',
    operation: 'create',
    path: 'users/user_1/threads/thread_1',
    authUid: 'user_1',
    emailVerified: true,
    payload: { ownerId: 'user_2' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client-forged timestamp on crop',
    operation: 'create',
    path: 'users/user_1/crops/crop_1',
    authUid: 'user_1',
    emailVerified: true,
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Immutable ownerId mutation on update',
    operation: 'update',
    path: 'users/user_1/crops/crop_1',
    authUid: 'user_1',
    emailVerified: true,
    payload: { ownerId: 'user_2' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Oversized thread messages array (>50)',
    operation: 'create',
    path: 'users/user_1/threads/thread_1',
    authUid: 'user_1',
    emailVerified: true,
    payload: { messagesCount: 51 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Terminal stage crop modification after sent-to-market',
    operation: 'update',
    path: 'users/user_1/crops/crop_1',
    authUid: 'user_1',
    emailVerified: true,
    payload: { stage: 'growing' },
    expected: 'PERMISSION_DENIED',
  },
];
