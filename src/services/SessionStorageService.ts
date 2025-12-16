/**
 * Humble Object for IndexedDB session storage.
 * Stores practice sessions with their video blobs separately for efficient pruning.
 * See docs/ARCHITECTURE-practice-recorder.md for schema details.
 */

import type { PracticeSession } from "../types/sessions";
import { SESSION_CONFIG } from "../types/sessions";

const DB_NAME = "magic-monitor-sessions";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions";
const BLOBS_STORE = "blobs";

let dbInstance: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
	if (dbInstance) {
		return Promise.resolve(dbInstance);
	}

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			reject(new Error("Failed to open IndexedDB"));
		};

		request.onsuccess = () => {
			dbInstance = request.result;
			// Clear dbInstance if database closes unexpectedly
			dbInstance.onclose = () => {
				dbInstance = null;
			};
			resolve(dbInstance);
		};

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			// Sessions store
			if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
				const sessionsStore = db.createObjectStore(SESSIONS_STORE, {
					keyPath: "id",
				});
				sessionsStore.createIndex("createdAt", "createdAt", { unique: false });
				sessionsStore.createIndex("saved", "saved", { unique: false });
			}

			// Blobs store (separate for efficient pruning)
			if (!db.objectStoreNames.contains(BLOBS_STORE)) {
				db.createObjectStore(BLOBS_STORE, { keyPath: "id" });
			}
		};
	});
}

function generateId(): string {
	return crypto.randomUUID();
}

export const SessionStorageService = {
	/**
	 * Initialize the database connection.
	 */
	async init(): Promise<void> {
		await getDB();
	},

	// ===== Create =====

	/**
	 * Save a new session and its blob together atomically.
	 * Uses a single transaction to ensure both are saved or neither is saved.
	 * Returns the generated session ID.
	 */
	async saveSessionWithBlob(
		session: Omit<PracticeSession, "id">,
		blob: Blob,
	): Promise<string> {
		const db = await getDB();
		const id = generateId();
		const fullSession: PracticeSession = { ...session, id };

		return new Promise((resolve, reject) => {
			// Single transaction spanning both stores for atomicity
			const tx = db.transaction([SESSIONS_STORE, BLOBS_STORE], "readwrite");
			const sessionsStore = tx.objectStore(SESSIONS_STORE);
			const blobsStore = tx.objectStore(BLOBS_STORE);

			// Queue both save operations in the same transaction
			sessionsStore.add(fullSession);
			blobsStore.put({ id, blob });

			tx.oncomplete = () => resolve(id);
			tx.onerror = () => reject(new Error("Failed to save session with blob"));
		});
	},

	/**
	 * Save a new session. Returns the generated session ID.
	 */
	async saveSession(
		session: Omit<PracticeSession, "id">,
	): Promise<string> {
		const db = await getDB();
		const id = generateId();
		const fullSession: PracticeSession = { ...session, id };

		return new Promise((resolve, reject) => {
			const tx = db.transaction(SESSIONS_STORE, "readwrite");
			const store = tx.objectStore(SESSIONS_STORE);
			const request = store.add(fullSession);

			request.onsuccess = () => resolve(id);
			request.onerror = () => reject(new Error("Failed to save session"));
		});
	},

	/**
	 * Save a video blob for a session.
	 */
	async saveBlob(id: string, blob: Blob): Promise<void> {
		const db = await getDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction(BLOBS_STORE, "readwrite");
			const store = tx.objectStore(BLOBS_STORE);
			const request = store.put({ id, blob });

			request.onsuccess = () => resolve();
			request.onerror = () => reject(new Error("Failed to save blob"));
		});
	},

	// ===== Read =====

	/**
	 * Get a session by ID.
	 */
	async getSession(id: string): Promise<PracticeSession | null> {
		const db = await getDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction(SESSIONS_STORE, "readonly");
			const store = tx.objectStore(SESSIONS_STORE);
			const request = store.get(id);

			request.onsuccess = () =>
				resolve((request.result as PracticeSession) ?? null);
			request.onerror = () => reject(new Error("Failed to get session"));
		});
	},

	/**
	 * Get a video blob by session ID.
	 */
	async getBlob(id: string): Promise<Blob | null> {
		const db = await getDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction(BLOBS_STORE, "readonly");
			const store = tx.objectStore(BLOBS_STORE);
			const request = store.get(id);

			request.onsuccess = () => {
				const result = request.result as { id: string; blob: Blob } | undefined;
				resolve(result?.blob ?? null);
			};
			request.onerror = () => reject(new Error("Failed to get blob"));
		});
	},

	/**
	 * Get recent (unsaved) sessions, ordered by createdAt descending.
	 * Uses getAll and filters in JS for browser compatibility (IDBKeyRange.only(boolean) not supported everywhere).
	 */
	async getRecentSessions(limit = 10): Promise<PracticeSession[]> {
		const db = await getDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction(SESSIONS_STORE, "readonly");
			const store = tx.objectStore(SESSIONS_STORE);
			const request = store.getAll();

			request.onsuccess = () => {
				const sessions = (request.result as PracticeSession[])
					.filter((s) => !s.saved)
					.sort((a, b) => b.createdAt - a.createdAt)
					.slice(0, limit);
				resolve(sessions);
			};
			request.onerror = () => reject(new Error("Failed to get recent sessions"));
		});
	},

	/**
	 * Get saved sessions, ordered by createdAt descending.
	 * Uses getAll and filters in JS for browser compatibility.
	 */
	async getSavedSessions(): Promise<PracticeSession[]> {
		const db = await getDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction(SESSIONS_STORE, "readonly");
			const store = tx.objectStore(SESSIONS_STORE);
			const request = store.getAll();

			request.onsuccess = () => {
				const sessions = (request.result as PracticeSession[])
					.filter((s) => s.saved)
					.sort((a, b) => b.createdAt - a.createdAt);
				resolve(sessions);
			};
			request.onerror = () => reject(new Error("Failed to get saved sessions"));
		});
	},

	/**
	 * Get all sessions.
	 */
	async getAllSessions(): Promise<PracticeSession[]> {
		const db = await getDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction(SESSIONS_STORE, "readonly");
			const store = tx.objectStore(SESSIONS_STORE);
			const request = store.getAll();

			request.onsuccess = () => {
				const sessions = request.result as PracticeSession[];
				sessions.sort((a, b) => b.createdAt - a.createdAt);
				resolve(sessions);
			};
			request.onerror = () => reject(new Error("Failed to get all sessions"));
		});
	},

	// ===== Update =====

	/**
	 * Update a session's fields.
	 */
	async updateSession(
		id: string,
		updates: Partial<PracticeSession>,
	): Promise<void> {
		const db = await getDB();
		const existing = await this.getSession(id);
		if (!existing) {
			throw new Error(`Session ${id} not found`);
		}

		const updated = { ...existing, ...updates, id }; // Preserve ID

		return new Promise((resolve, reject) => {
			const tx = db.transaction(SESSIONS_STORE, "readwrite");
			const store = tx.objectStore(SESSIONS_STORE);
			const request = store.put(updated);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(new Error("Failed to update session"));
		});
	},

	/**
	 * Mark a session as saved with a name.
	 */
	async markAsSaved(id: string, name: string): Promise<void> {
		await this.updateSession(id, { saved: true, name });
	},

	/**
	 * Set trim points on a session.
	 */
	async setTrimPoints(
		id: string,
		trimIn: number,
		trimOut: number,
	): Promise<void> {
		await this.updateSession(id, { trimIn, trimOut });
	},

	// ===== Delete =====

	/**
	 * Delete a session (metadata only).
	 */
	async deleteSession(id: string): Promise<void> {
		const db = await getDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction(SESSIONS_STORE, "readwrite");
			const store = tx.objectStore(SESSIONS_STORE);
			const request = store.delete(id);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(new Error("Failed to delete session"));
		});
	},

	/**
	 * Delete a blob.
	 */
	async deleteBlob(id: string): Promise<void> {
		const db = await getDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction(BLOBS_STORE, "readwrite");
			const store = tx.objectStore(BLOBS_STORE);
			const request = store.delete(id);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(new Error("Failed to delete blob"));
		});
	},

	/**
	 * Delete a session and its blob together atomically.
	 * Uses a single transaction to ensure both are deleted or neither is deleted.
	 */
	async deleteSessionWithBlob(id: string): Promise<void> {
		const db = await getDB();

		return new Promise((resolve, reject) => {
			// Single transaction spanning both stores for atomicity
			const tx = db.transaction([SESSIONS_STORE, BLOBS_STORE], "readwrite");
			const sessionsStore = tx.objectStore(SESSIONS_STORE);
			const blobsStore = tx.objectStore(BLOBS_STORE);

			// Queue both delete operations in the same transaction
			sessionsStore.delete(id);
			blobsStore.delete(id);

			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(new Error("Failed to delete session with blob"));
		});
	},

	// ===== Pruning =====

	/**
	 * Prune old unsaved sessions, keeping only the most recent ones
	 * up to the configured duration limit.
	 * Returns the count of deleted sessions.
	 */
	async pruneOldSessions(
		keepDurationSeconds = SESSION_CONFIG.MAX_RECENT_DURATION_SECONDS,
	): Promise<number> {
		const unsaved = await this.getRecentSessions(1000); // Get all unsaved

		let totalDurationSeconds = 0;
		const toKeep: string[] = [];
		const toDelete: string[] = [];

		// Sessions are already sorted newest first
		for (const session of unsaved) {
			if (totalDurationSeconds < keepDurationSeconds) {
				toKeep.push(session.id);
				totalDurationSeconds += session.duration;
			} else {
				toDelete.push(session.id);
			}
		}

		// Delete old sessions and their blobs
		await Promise.all(
			toDelete.map((id) => this.deleteSessionWithBlob(id)),
		);

		return toDelete.length;
	},

	/**
	 * Get storage usage estimate.
	 */
	async getStorageUsage(): Promise<{ used: number; quota: number }> {
		if ("storage" in navigator && "estimate" in navigator.storage) {
			const estimate = await navigator.storage.estimate();
			return {
				used: estimate.usage ?? 0,
				quota: estimate.quota ?? 0,
			};
		}
		// Fallback: no estimate available
		return { used: 0, quota: 0 };
	},

	// ===== Cleanup =====

	/**
	 * Clear all sessions and blobs.
	 */
	async clear(): Promise<void> {
		const db = await getDB();

		return new Promise((resolve, reject) => {
			const tx = db.transaction([SESSIONS_STORE, BLOBS_STORE], "readwrite");

			const sessionsStore = tx.objectStore(SESSIONS_STORE);
			const blobsStore = tx.objectStore(BLOBS_STORE);

			sessionsStore.clear();
			blobsStore.clear();

			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(new Error("Failed to clear storage"));
		});
	},

	/**
	 * Close database connection.
	 */
	close(): void {
		if (dbInstance) {
			dbInstance.close();
			dbInstance = null;
		}
	},
};

export type SessionStorageServiceType = typeof SessionStorageService;
