/**
 * Humble Object for IndexedDB video chunk storage.
 * Stores video chunks and preview frames for disk-based rewind buffer.
 */

export interface VideoChunk {
	id: number;
	timestamp: number;
	blob: Blob;
	preview: Blob;
	duration: number; // Duration in ms
}

const DB_NAME = "magic-monitor-rewind";
const DB_VERSION = 1;
const STORE_NAME = "chunks";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;

	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, {
					keyPath: "id",
					autoIncrement: true,
				});
				store.createIndex("timestamp", "timestamp", { unique: false });
			}
		};
	});

	return dbPromise;
}

export const DiskBufferService = {
	async init(): Promise<void> {
		await openDatabase();
	},

	async saveChunk(
		blob: Blob,
		preview: Blob,
		timestamp: number,
		duration: number,
	): Promise<number> {
		const db = await openDatabase();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readwrite");
			const store = tx.objectStore(STORE_NAME);

			const chunk: Omit<VideoChunk, "id"> = {
				timestamp,
				blob,
				preview,
				duration,
			};

			const request = store.add(chunk);
			request.onsuccess = () => resolve(request.result as number);
			request.onerror = () => reject(request.error);
		});
	},

	async getChunk(id: number): Promise<VideoChunk | null> {
		const db = await openDatabase();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readonly");
			const store = tx.objectStore(STORE_NAME);
			const request = store.get(id);
			request.onsuccess = () => resolve(request.result ?? null);
			request.onerror = () => reject(request.error);
		});
	},

	async getAllChunks(): Promise<VideoChunk[]> {
		const db = await openDatabase();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readonly");
			const store = tx.objectStore(STORE_NAME);
			const request = store.getAll();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	},

	async getChunkCount(): Promise<number> {
		const db = await openDatabase();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readonly");
			const store = tx.objectStore(STORE_NAME);
			const request = store.count();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	},

	async getPreviewFrames(): Promise<{ id: number; preview: Blob; timestamp: number }[]> {
		const chunks = await this.getAllChunks();
		return chunks.map((c) => ({
			id: c.id,
			preview: c.preview,
			timestamp: c.timestamp,
		}));
	},

	async pruneOldChunks(keepCount: number): Promise<number> {
		const db = await openDatabase();
		const chunks = await this.getAllChunks();

		if (chunks.length <= keepCount) return 0;

		// Sort by timestamp ascending (oldest first)
		chunks.sort((a, b) => a.timestamp - b.timestamp);
		const toDelete = chunks.slice(0, chunks.length - keepCount);

		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readwrite");
			const store = tx.objectStore(STORE_NAME);
			let deleted = 0;

			for (const chunk of toDelete) {
				const request = store.delete(chunk.id);
				request.onsuccess = () => {
					deleted++;
				};
			}

			tx.oncomplete = () => resolve(deleted);
			tx.onerror = () => reject(tx.error);
		});
	},

	async clearAll(): Promise<void> {
		const db = await openDatabase();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, "readwrite");
			const store = tx.objectStore(STORE_NAME);
			const request = store.clear();
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	},

	async exportVideo(): Promise<Blob | null> {
		const chunks = await this.getAllChunks();
		if (chunks.length === 0) return null;

		// Sort by timestamp
		chunks.sort((a, b) => a.timestamp - b.timestamp);

		// Concatenate all blobs
		const blobs = chunks.map((c) => c.blob);
		return new Blob(blobs, { type: chunks[0].blob.type });
	},

	async getStorageEstimate(): Promise<{ used: number; quota: number } | null> {
		if ("storage" in navigator && "estimate" in navigator.storage) {
			const estimate = await navigator.storage.estimate();
			return {
				used: estimate.usage ?? 0,
				quota: estimate.quota ?? 0,
			};
		}
		return null;
	},
};

export type DiskBufferServiceType = typeof DiskBufferService;
