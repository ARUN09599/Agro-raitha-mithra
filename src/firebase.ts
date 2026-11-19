import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  AgriSector,
  ChatMessage,
  ChatThread,
  CropStage,
  FarmingMode,
  KrishiCropItem,
  LanguageMode,
} from './types.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

export async function signInWithGooglePopup(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, type User };

export async function ensureUserProfile(
  user: User,
  preferredLanguage: LanguageMode,
  preferredFarmingMode: FarmingMode
): Promise<void> {
  const uid = sanitizeId(user.uid);
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  const email = (user.email || '').slice(0, 200);
  const displayName = (user.displayName || '').slice(0, 120);
  const photoUrl = (user.photoURL || '').slice(0, 500);

  if (!snap.exists()) {
    try {
      await setDoc(ref, {
        uid,
        displayName,
        email,
        photoUrl,
        preferredLanguage,
        preferredFarmingMode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        displayName,
        email,
        photoUrl,
        preferredLanguage,
        preferredFarmingMode,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }
}

function compactMessagesForFirestore(msgs: ChatMessage[]): Array<Record<string, unknown>> {
  return msgs.slice(-50).map((m) => ({
    id: String(m.id || '').slice(0, 128),
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 12000),
    timestamp: String(m.timestamp || new Date().toISOString()).slice(0, 40),
    ...(m.sector ? { sector: m.sector } : {}),
    ...(m.sources && m.sources.length > 0 ? { sources: m.sources.slice(0, 10) } : {}),
    ...(m.error ? { error: String(m.error).slice(0, 400) } : {}),
  }));
}

export async function saveThreadToFirestore(
  userId: string,
  thread: ChatThread
): Promise<void> {
  const uid = sanitizeId(userId);
  const threadId = sanitizeId(thread.id);
  const path = `users/${uid}/threads/${threadId}`;
  const ref = doc(db, 'users', uid, 'threads', threadId);

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  const validSectors = new Set<AgriSector>([
    'all',
    'row-crops',
    'horticulture',
    'greenhouse',
    'livestock',
    'aquaculture',
  ]);
  const sector: AgriSector = validSectors.has(thread.sector)
    ? thread.sector
    : 'all';

  const payloadFields = {
    title: (thread.title || 'Saved Chat').slice(0, 120),
    sector,
    language: thread.language || 'kn-village',
    farmingMode: thread.farmingMode || 'both',
    messages: compactMessagesForFirestore(thread.messages),
    updatedAtClient: (thread.updatedAt || new Date().toISOString()).slice(0, 40),
    updatedAt: serverTimestamp(),
  };

  if (!existingSnap.exists()) {
    try {
      await setDoc(ref, {
        id: threadId,
        ownerId: uid,
        ...payloadFields,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, payloadFields);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }
}

export async function deleteThreadFromFirestore(
  userId: string,
  threadId: string
): Promise<void> {
  const uid = sanitizeId(userId);
  const tid = sanitizeId(threadId);
  const path = `users/${uid}/threads/${tid}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'threads', tid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeUserThreads(
  userId: string,
  onThreads: (threads: ChatThread[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const uid = sanitizeId(userId);
  const path = `users/${uid}/threads`;
  const q = query(
    collection(db, 'users', uid, 'threads'),
    where('ownerId', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ChatThread[] = snapshot.docs.map((d) => {
        const data = d.data() as {
          id?: string;
          title?: string;
          sector?: AgriSector;
          language?: LanguageMode;
          farmingMode?: FarmingMode;
          updatedAtClient?: string;
          updatedAt?: Timestamp;
          messages?: ChatMessage[];
        };
        const updatedAt =
          data.updatedAtClient ||
          (data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate().toISOString()
            : new Date().toISOString());
        return {
          id: data.id || d.id,
          title: data.title || 'Saved Chat',
          sector: data.sector || 'all',
          language: data.language || 'kn-village',
          farmingMode: data.farmingMode || 'both',
          updatedAt,
          messages: Array.isArray(data.messages)
            ? data.messages.map((m) => ({ ...m, isStreaming: false }))
            : [],
        };
      });
      items.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      onThreads(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (handled) {
        if (onError) onError(handled);
      }
    }
  );
}

function compactLogsForFirestore(
  logs: KrishiCropItem['logs']
): Array<Record<string, unknown>> {
  return (logs || []).slice(0, 30).map((log, idx) => {
    const cleanLog: Record<string, unknown> = {
      id: String(log.id || '').slice(0, 128),
      date: String(log.date || '').slice(0, 20),
      dayNumber: Number(log.dayNumber || 1),
      changesObserved: String(log.changesObserved || '').slice(0, 1000),
      problemObserved: String(log.problemObserved || '').slice(0, 1000),
      aiGuidance: String(log.aiGuidance || '').slice(0, 10000),
    };
    if (log.weatherNote) cleanLog.weatherNote = String(log.weatherNote).slice(0, 400);
    if (log.detectedStage) cleanLog.detectedStage = log.detectedStage;
    if (log.stageLabel) cleanLog.stageLabel = String(log.stageLabel).slice(0, 100);
    if (log.diseaseName) cleanLog.diseaseName = String(log.diseaseName).slice(0, 150);
    if (log.healthStatus) cleanLog.healthStatus = log.healthStatus;
    if (typeof log.daysToHarvest === 'number') cleanLog.daysToHarvest = log.daysToHarvest;
    if (typeof log.recoveryDays === 'number') cleanLog.recoveryDays = log.recoveryDays;
    if (log.solutionSummary) {
      cleanLog.solutionSummary = String(log.solutionSummary).slice(0, 500);
    }
    if (log.scanSource) cleanLog.scanSource = log.scanSource;
    // Sync thumbnails for the latest 6 scans so Firestore doc stays compact (< 250 KB)
    if (idx < 6 && log.photoThumbUrl && log.photoThumbUrl.length < 40000) {
      cleanLog.photoThumbUrl = log.photoThumbUrl;
    }
    return cleanLog;
  });
}

export async function saveCropToFirestore(
  userId: string,
  crop: KrishiCropItem
): Promise<void> {
  const uid = sanitizeId(userId);
  const cropId = sanitizeId(crop.id);
  const path = `users/${uid}/crops/${cropId}`;
  const ref = doc(db, 'users', uid, 'crops', cropId);

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  const validStages = new Set<CropStage>([
    'sowing',
    'growing',
    'flowering',
    'cutting-ready',
    'sent-to-market',
  ]);
  const stage: CropStage = validStages.has(crop.stage)
    ? crop.stage
    : 'growing';

  const compactLogs = compactLogsForFirestore(crop.logs);

  if (!existingSnap.exists()) {
    try {
      await setDoc(ref, {
        id: cropId,
        ownerId: uid,
        cropName: String(crop.cropName || 'Crop').slice(0, 100),
        sowingDate: String(crop.sowingDate || '').slice(0, 20),
        state: String(crop.state || 'Karnataka').slice(0, 80),
        district: String(crop.district || 'Bengaluru Urban').slice(0, 80),
        taluk: String(crop.taluk || '').slice(0, 80),
        stage,
        logs: compactLogs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  } else {
    const existingData = existingSnap.data() as { stage?: CropStage };
    if (existingData?.stage === 'sent-to-market') {
      return;
    }
    try {
      await updateDoc(ref, {
        stage,
        logs: compactLogs,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }
}

export async function deleteCropFromFirestore(
  userId: string,
  cropId: string
): Promise<void> {
  const uid = sanitizeId(userId);
  const cid = sanitizeId(cropId);
  const path = `users/${uid}/crops/${cid}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'crops', cid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeUserCrops(
  userId: string,
  onCrops: (crops: KrishiCropItem[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const uid = sanitizeId(userId);
  const path = `users/${uid}/crops`;
  const q = query(
    collection(db, 'users', uid, 'crops'),
    where('ownerId', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: KrishiCropItem[] = snapshot.docs.map((d) => {
        const data = d.data() as KrishiCropItem;
        return {
          id: data.id || d.id,
          cropName: data.cropName || 'Crop',
          sowingDate: data.sowingDate || '',
          state: data.state || 'Karnataka',
          district: data.district || 'Bengaluru Urban',
          taluk: data.taluk || '',
          stage: data.stage || 'growing',
          logs: Array.isArray(data.logs) ? data.logs : [],
        };
      });
      onCrops(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (handled) {
        if (onError) onError(handled);
      }
    }
  );
}
