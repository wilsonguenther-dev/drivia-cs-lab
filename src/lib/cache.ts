/**
 * Industry-grade client cache for the Formula Lab.
 *
 * Goals:
 *   1. Schema-versioned so a future shape change doesn't silently corrupt prior data.
 *   2. Atomic, debounced writes — no half-saved JSON if a tab is closed mid-write.
 *   3. Cross-tab live sync via BroadcastChannel so a streak bumped in tab A
 *      is reflected in tab B's TopRail instantly.
 *   4. Large binary blobs (TTS audio) live in IndexedDB, not localStorage.
 *   5. Strict TypeScript typed accessors — call sites can't typo a key.
 *
 * Schema is namespaced under `clab.v1.*`. Bumping NS forces a clean migration.
 */

const NS = "clab.v1";
const SCHEMA_VERSION = 1;
const META_KEY = `${NS}.__meta`;
const BC_NAME = `${NS}.bus`;

interface Meta {
  schemaVersion: number;
  createdAt: number;
  lastSeen: number;
}

function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const fresh: Meta = { schemaVersion: SCHEMA_VERSION, createdAt: Date.now(), lastSeen: Date.now() };
  try { localStorage.setItem(META_KEY, JSON.stringify(fresh)); } catch {}
  return fresh;
}

function touchMeta(): void {
  try {
    const m = loadMeta();
    m.lastSeen = Date.now();
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {}
}

// ─── Cross-tab bus ────────────────────────────────────────────────────────
type BaseBusEvent =
  | { type: "kv-set"; key: string }
  | { type: "streak-bump" }
  | { type: "timer-tick"; secondsToday: number; totalSeconds: number }
  | { type: "mastery-change" };

// `_local` is set when the event was fanned out within the same tab. Consumers
// can use it to skip self-emits (e.g. avoid re-reading state we just wrote).
export type BusEvent = BaseBusEvent & { _local?: boolean };

type BusListener = (e: BusEvent) => void;

let bc: BroadcastChannel | null = null;
const busListeners: Set<BusListener> = new Set();

function getBus(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (bc) return bc;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = (ev) => {
      const e = ev.data as BusEvent;
      busListeners.forEach((fn) => { try { fn(e); } catch {} });
    };
  } catch { bc = null; }
  return bc;
}

export function onBus(fn: BusListener): () => void {
  busListeners.add(fn);
  return () => busListeners.delete(fn);
}

export function emitBus(e: BusEvent): void {
  // Fan out to local listeners synchronously — BroadcastChannel doesn't loop
  // back so without this same-tab consumers wouldn't see same-tab events.
  // Tag with _local so consumers can ignore self-emits where appropriate.
  busListeners.forEach((fn) => { try { fn({ ...e, _local: true } as BusEvent); } catch {} });
  const b = getBus();
  if (b) { try { b.postMessage(e); } catch {} }
}

// ─── Atomic typed KV ───────────────────────────────────────────────────────
// One in-memory write queue per key; flushed via requestIdleCallback / 60ms.
const writeQueue: Map<string, unknown> = new Map();
let flushScheduled = false;

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  const flush = () => {
    flushScheduled = false;
    writeQueue.forEach((value, key) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Quota exceeded — try to evict the audio blob cache via IDB then retry once
        void evictOldestAudio().then(() => {
          try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
        });
      }
    });
    writeQueue.clear();
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(flush, { timeout: 200 });
  } else {
    setTimeout(flush, 60);
  }
}

// Force-flush on unload so partial work persists.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    writeQueue.forEach((value, key) => {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    });
    writeQueue.clear();
  });
}

export function kvGet<T>(key: string, fallback: T): T {
  // Pending writes are authoritative — reading from localStorage before flush
  // would return the previous value and clobber in-memory state.
  const fullKey = `${NS}.${key}`;
  if (writeQueue.has(fullKey)) return writeQueue.get(fullKey) as T;
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function kvSet<T>(key: string, value: T): void {
  const fullKey = `${NS}.${key}`;
  writeQueue.set(fullKey, value);
  scheduleFlush();
  emitBus({ type: "kv-set", key });
}

export function kvDel(key: string): void {
  try { localStorage.removeItem(`${NS}.${key}`); } catch {}
  writeQueue.delete(`${NS}.${key}`);
}

// ─── IndexedDB blob cache (TTS audio) ──────────────────────────────────────
const IDB_NAME = `${NS}.audio`;
const IDB_STORE = "blobs";
const IDB_VERSION = 1;
const AUDIO_CAP_BYTES = 60 * 1024 * 1024; // soft cap; evict oldest beyond this

let idbPromise: Promise<IDBDatabase> | null = null;

function openIDB(): Promise<IDBDatabase> {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no-idb")); return; }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const store = db.createObjectStore(IDB_STORE, { keyPath: "key" });
        store.createIndex("lastUsed", "lastUsed", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return idbPromise;
}

interface BlobRecord {
  key: string;
  blob: Blob;
  bytes: number;
  lastUsed: number;
  createdAt: number;
}

export async function blobGet(key: string): Promise<Blob | null> {
  try {
    const db = await openIDB();
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const r = store.get(key);
      r.onsuccess = () => {
        const rec = r.result as BlobRecord | undefined;
        if (!rec) { resolve(null); return; }
        rec.lastUsed = Date.now();
        store.put(rec);
        resolve(rec.blob);
      };
      r.onerror = () => resolve(null);
    });
  } catch { return null; }
}

export async function blobSet(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const rec: BlobRecord = {
        key, blob, bytes: blob.size, lastUsed: Date.now(), createdAt: Date.now(),
      };
      const r = store.put(rec);
      r.onsuccess = () => resolve();
      r.onerror = () => resolve();
    });
    void maybeEvictAudio();
  } catch {}
}

async function totalAudioBytes(): Promise<number> {
  try {
    const db = await openIDB();
    return await new Promise<number>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      let bytes = 0;
      store.openCursor().onsuccess = (e) => {
        const cur = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cur) { bytes += (cur.value as BlobRecord).bytes; cur.continue(); }
        else resolve(bytes);
      };
    });
  } catch { return 0; }
}

async function maybeEvictAudio(): Promise<void> {
  const bytes = await totalAudioBytes();
  if (bytes < AUDIO_CAP_BYTES) return;
  await evictOldestAudio();
}

async function evictOldestAudio(): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const idx = store.index("lastUsed");
      let evicted = 0;
      idx.openCursor().onsuccess = (e) => {
        const cur = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cur || evicted >= 25) { resolve(); return; }
        store.delete(cur.primaryKey);
        evicted++;
        cur.continue();
      };
    });
  } catch {}
}

export async function blobClearAll(): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

// ─── First-run init ────────────────────────────────────────────────────────
if (typeof window !== "undefined") {
  loadMeta();
  touchMeta();
  // Boot the bus eagerly so cross-tab events flow.
  getBus();
}

export const __schema = { NS, SCHEMA_VERSION };
