// Typing event recorder
//
// - In renderer, components call recordEdit(src, entityId, text) on every keystroke.
// - We coalesce edits to the same (src, entityId) so only the final value per
//   entity per batch is retained.
// - We flush when ANY of these happen:
//     * 5s of idle (no new edit)
//     * 100 distinct entities buffered
//     * 60s since first un-flushed edit
//     * page visibility -> hidden (window closed / hide-to-tray)
// - On flush: gzip JSON via CompressionStream + base64, then write one
//   Firestore doc under users/{uid}/typingBatches/{batchId}.
// - A backup copy of the buffer is mirrored to localStorage between flushes so
//   we don't lose edits on hard crash. On startup, any leftover buffer is
//   flushed before new edits accumulate.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ensureSignedIn, firestore, getCurrentUser } from './firebase';

export type RecordSource = 'todo' | 'goal' | 'editor' | 'project' | 'settings' | 'other';

export interface TypingEvent {
    /** Source bucket (todo, goal, editor, etc.) */
    src: RecordSource;
    /** Stable id within the source (todo id, "monthly-goal", "project:{id}", ...) */
    entityId: string;
    /** Final text value after the edit. */
    text: string;
    /** Timestamp (ms) of the *latest* keystroke that produced `text`. */
    t: number;
    /** First time this entity was seen in the current batch. */
    firstT: number;
    /** Number of keystrokes (recordEdit calls) coalesced into this entry. */
    strokes: number;
}

interface BatchPayload {
    /** Schema version; bump if you change the shape. */
    v: 1;
    /** Wall-clock start of the batch (ms). */
    startedAt: number;
    /** Wall-clock end of the batch (ms). */
    endedAt: number;
    events: TypingEvent[];
}

const BUFFER_KEY = 'artisans-compass:typing-buffer';
const IDLE_FLUSH_MS = 5_000;
const MAX_ENTITIES = 100;
const MAX_AGE_MS = 60_000;

// In-memory buffer keyed by `${src}::${entityId}`.
const buffer = new Map<string, TypingEvent>();
let firstEditAt = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let maxAgeTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let enabled = true;
let pendingFlush: Promise<void> | null = null;

// --- Public API ---

export function setRecorderEnabled(value: boolean): void {
    enabled = value;
    if (!value) {
        clearTimers();
    }
}

export function isRecorderEnabled(): boolean {
    return enabled;
}

export function recordEdit(src: RecordSource, entityId: string, text: string): void {
    if (!enabled) return;
    if (typeof text !== 'string') return;

    const now = Date.now();
    const key = `${src}::${entityId}`;
    const existing = buffer.get(key);
    if (existing) {
        existing.text = text;
        existing.t = now;
        existing.strokes += 1;
    } else {
        buffer.set(key, {
            src,
            entityId,
            text,
            t: now,
            firstT: now,
            strokes: 1,
        });
        if (firstEditAt === 0) firstEditAt = now;
    }

    persistBuffer();

    if (buffer.size >= MAX_ENTITIES) {
        scheduleFlush(0);
        return;
    }

    scheduleIdleFlush();
    scheduleMaxAgeFlush();
}

/** Force-flush. Returns the in-flight or just-started flush promise. */
export function flushNow(): Promise<void> {
    return scheduleFlush(0);
}

// --- Init: run-once setup ---

let initialized = false;
export function initTypingRecorder(): void {
    if (initialized) return;
    initialized = true;

    // Rescue leftover buffer from a previous session.
    try {
        const raw = localStorage.getItem(BUFFER_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as TypingEvent[];
            if (Array.isArray(parsed) && parsed.length > 0) {
                for (const ev of parsed) {
                    buffer.set(`${ev.src}::${ev.entityId}`, ev);
                }
                firstEditAt = parsed.reduce(
                    (min, ev) => (min === 0 ? ev.firstT : Math.min(min, ev.firstT)),
                    0,
                );
                // Don't wait — push the rescued batch out promptly.
                scheduleFlush(0);
            }
        }
    } catch (e) {
        console.warn('[typing-recorder] failed to rescue buffer', e);
        try {
            localStorage.removeItem(BUFFER_KEY);
        } catch {
            /* ignore */
        }
    }

    // Hide / unload paths — flush synchronously-ish before window dies.
    if (typeof window !== 'undefined') {
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && buffer.size > 0) {
                flushNow();
            }
        });
        window.addEventListener('pagehide', () => {
            if (buffer.size > 0) flushNow();
        });
        window.addEventListener('beforeunload', () => {
            if (buffer.size > 0) flushNow();
        });
    }
}

// --- Internals ---

function scheduleIdleFlush(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => scheduleFlush(0), IDLE_FLUSH_MS);
}

function scheduleMaxAgeFlush(): void {
    if (maxAgeTimer) return;
    const elapsed = firstEditAt ? Date.now() - firstEditAt : 0;
    const remaining = Math.max(0, MAX_AGE_MS - elapsed);
    maxAgeTimer = setTimeout(() => scheduleFlush(0), remaining);
}

function clearTimers(): void {
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }
    if (maxAgeTimer) {
        clearTimeout(maxAgeTimer);
        maxAgeTimer = null;
    }
}

function scheduleFlush(_delayMs: number): Promise<void> {
    if (pendingFlush) return pendingFlush;
    pendingFlush = (async () => {
        try {
            await flushInternal();
        } finally {
            pendingFlush = null;
        }
    })();
    return pendingFlush;
}

async function flushInternal(): Promise<void> {
    if (flushing) return;
    if (buffer.size === 0) {
        clearTimers();
        firstEditAt = 0;
        return;
    }
    flushing = true;
    clearTimers();

    // Drain the buffer into a snapshot. New edits during the upload land in a
    // fresh batch.
    const events = Array.from(buffer.values()).sort((a, b) => a.firstT - b.firstT);
    buffer.clear();
    const startedAt = firstEditAt || events[0].firstT;
    const endedAt = Date.now();
    firstEditAt = 0;
    persistBuffer(); // empty buffer -> clears localStorage

    try {
        await ensureSignedIn();
        const payload: BatchPayload = { v: 1, startedAt, endedAt, events };
        const json = JSON.stringify(payload);
        const compressedB64 = await gzipToBase64(json);
        const user = getCurrentUser();
        if (!user) throw new Error('no user');

        const col = collection(firestore, 'users', user.uid, 'typingBatches');
        await addDoc(col, {
            v: 1,
            startedAt,
            endedAt,
            eventCount: events.length,
            uncompressedSize: json.length,
            compressedSize: compressedB64.length,
            // Base64 of gzip(JSON.stringify(payload.events))
            payloadB64: compressedB64,
            uploadedAt: serverTimestamp(),
        });
    } catch (err) {
        console.error('[typing-recorder] flush failed, re-queuing', err);
        // Re-merge what we tried to send so we don't lose it. If buffer already
        // has newer values for the same entity, keep the newer one.
        for (const ev of events) {
            const key = `${ev.src}::${ev.entityId}`;
            const existing = buffer.get(key);
            if (!existing || existing.t < ev.t) {
                buffer.set(key, ev);
            }
        }
        if (firstEditAt === 0 || startedAt < firstEditAt) firstEditAt = startedAt;
        persistBuffer();
        // Don't immediately retry — wait for next edit or idle window.
    } finally {
        flushing = false;
    }
}

function persistBuffer(): void {
    try {
        if (buffer.size === 0) {
            localStorage.removeItem(BUFFER_KEY);
            return;
        }
        const arr = Array.from(buffer.values());
        localStorage.setItem(BUFFER_KEY, JSON.stringify(arr));
    } catch {
        /* localStorage full or unavailable — non-fatal */
    }
}

async function gzipToBase64(input: string): Promise<string> {
    // CompressionStream is available in Electron renderer (Chromium >= 80).
    if (typeof CompressionStream === 'undefined') {
        // Fallback: no compression, but still base64.
        return base64FromUint8(new TextEncoder().encode(input));
    }
    const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return base64FromUint8(new Uint8Array(buf));
}

function base64FromUint8(bytes: Uint8Array): string {
    // Chunked to avoid call-stack limits on large inputs.
    const CHUNK = 0x8000;
    let s = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(s);
}
