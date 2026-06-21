import {
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    Unsubscribe,
} from 'firebase/firestore';
import { firestore, ensureSignedIn, getCurrentUser } from './firebase';
import type { AppSettings, Project } from '@/types';

// --- Firestore data model ---
// users/{uid}                                          (doc: profile metadata)
// users/{uid}/state/settings                           (doc: AppSettings + updatedAt)
// users/{uid}/state/projects                           (doc: { projects: Project[], updatedAt })
// users/{uid}/dailyLogs/{YYYY-MM-DD}                   (doc: DailyLog + updatedAt)
//
// Daily logs are split per day so monthly pulls can scope by document id range
// and per-day pushes don't rewrite the whole month.

function uid(): string {
    const user = getCurrentUser();
    if (!user) throw new Error('[firestore-sync] no signed-in user');
    return user.uid;
}

// --- Profile ---

export async function touchProfile(): Promise<void> {
    await ensureSignedIn();
    const ref = doc(firestore, 'users', uid());
    await setDoc(
        ref,
        {
            lastSeenAt: serverTimestamp(),
            client: 'artisans-compass-desktop',
        },
        { merge: true },
    );
}

// --- Settings ---

export async function pushSettings(settings: AppSettings): Promise<void> {
    await ensureSignedIn();
    const ref = doc(firestore, 'users', uid(), 'state', 'settings');
    // Strip undefined keys — Firestore rejects them.
    const cleaned = stripUndefined(settings);
    await setDoc(
        ref,
        { ...cleaned, updatedAt: serverTimestamp() },
        { merge: true },
    );
}

export async function pullSettings(): Promise<AppSettings | null> {
    await ensureSignedIn();
    const ref = doc(firestore, 'users', uid(), 'state', 'settings');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    delete (data as any).updatedAt;
    return data as AppSettings;
}

export function subscribeSettings(cb: (s: AppSettings | null) => void): Unsubscribe {
    const user = getCurrentUser();
    if (!user) {
        // Defer subscription until signed in.
        let unsub: Unsubscribe | null = null;
        ensureSignedIn().then(() => {
            unsub = subscribeSettings(cb);
        });
        return () => unsub?.();
    }
    const ref = doc(firestore, 'users', user.uid, 'state', 'settings');
    return onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
            cb(null);
            return;
        }
        const data = snap.data();
        delete (data as any).updatedAt;
        cb(data as AppSettings);
    });
}

// --- Projects ---

export async function pushProjects(projects: Project[]): Promise<void> {
    await ensureSignedIn();
    const ref = doc(firestore, 'users', uid(), 'state', 'projects');
    await setDoc(ref, {
        projects: projects.map(stripUndefined),
        updatedAt: serverTimestamp(),
    });
}

export async function pullProjects(): Promise<Project[] | null> {
    await ensureSignedIn();
    const ref = doc(firestore, 'users', uid(), 'state', 'projects');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return (data?.projects ?? []) as Project[];
}

export function subscribeProjects(cb: (p: Project[] | null) => void): Unsubscribe {
    const user = getCurrentUser();
    if (!user) {
        let unsub: Unsubscribe | null = null;
        ensureSignedIn().then(() => {
            unsub = subscribeProjects(cb);
        });
        return () => unsub?.();
    }
    const ref = doc(firestore, 'users', user.uid, 'state', 'projects');
    return onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
            cb(null);
            return;
        }
        const data = snap.data();
        cb((data?.projects ?? []) as Project[]);
    });
}

// --- Daily logs ---

export async function pushDailyLog(dateStr: string, log: any): Promise<void> {
    await ensureSignedIn();
    const ref = doc(firestore, 'users', uid(), 'dailyLogs', dateStr);
    await setDoc(
        ref,
        {
            ...stripUndefined(log),
            date: dateStr,
            updatedAt: serverTimestamp(),
        },
        { merge: true },
    );
}

export async function pullDailyLog(dateStr: string): Promise<any | null> {
    await ensureSignedIn();
    const ref = doc(firestore, 'users', uid(), 'dailyLogs', dateStr);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
}

export async function pullMonthlyLogs(yearMonth: string): Promise<Record<string, any>> {
    await ensureSignedIn();
    const col = collection(firestore, 'users', uid(), 'dailyLogs');
    // Document ids are YYYY-MM-DD; we filter by prefix using date field for safety.
    const q = query(col, where('date', '>=', `${yearMonth}-01`), where('date', '<=', `${yearMonth}-31`));
    const snap = await getDocs(q);
    const out: Record<string, any> = {};
    snap.forEach((d) => {
        out[d.id] = d.data();
    });
    return out;
}

// --- Helpers ---

function stripUndefined<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((v) => stripUndefined(v)) as any;
    }
    if (value && typeof value === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(value as any)) {
            if (v === undefined) continue;
            out[k] = stripUndefined(v as any);
        }
        return out;
    }
    return value;
}

// --- Debounced uploader ---
// Some flows (typing in a todo) trigger many saves per second. Coalesce them.

export function makeDebouncedPusher<T>(
    fn: (value: T) => Promise<void>,
    delayMs = 800,
): (value: T) => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: T | null = null;
    return (value: T) => {
        pending = value;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            const v = pending as T;
            pending = null;
            timer = null;
            fn(v).catch((e) => console.error('[firestore-sync] push failed', e));
        }, delayMs);
    };
}
