import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_NAME = "magic-monitor-sessions";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions";
const BLOBS_STORE = "blobs";

/**
 * Seed the IndexedDB sessions database with test data.
 * This allows E2E tests to verify replay functionality without waiting for real recording.
 */
export async function seedSessionBuffer(
	page: Page,
	sessionCount: number = 3,
): Promise<void> {
	// Read test fixtures
	const fixturesDir = join(__dirname, "..", "fixtures");
	const videoBuffer = readFileSync(join(fixturesDir, "test-chunk.webm"));
	const previewBuffer = readFileSync(join(fixturesDir, "test-preview.jpg"));

	// Convert to base64 for transfer to browser
	const videoBase64 = videoBuffer.toString("base64");
	const previewBase64 = previewBuffer.toString("base64");

	await page.evaluate(
		async ({ dbName, dbVersion, sessionsStore, blobsStore, count, videoData, previewData }) => {
			// Convert base64 back to ArrayBuffer
			const videoArrayBuffer = Uint8Array.from(atob(videoData), (c) =>
				c.charCodeAt(0),
			).buffer;
			const previewDataUrl = `data:image/jpeg;base64,${previewData}`;

			// Open database
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open(dbName, dbVersion);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(request.result);
				request.onupgradeneeded = (event) => {
					const db = (event.target as IDBOpenDBRequest).result;
					// Sessions store
					if (!db.objectStoreNames.contains(sessionsStore)) {
						const store = db.createObjectStore(sessionsStore, {
							keyPath: "id",
						});
						store.createIndex("createdAt", "createdAt", { unique: false });
						store.createIndex("saved", "saved", { unique: false });
					}
					// Blobs store
					if (!db.objectStoreNames.contains(blobsStore)) {
						db.createObjectStore(blobsStore, { keyPath: "id" });
					}
				};
			});

			// Insert test sessions
			const baseTimestamp = Date.now() - count * 300000; // Start from past (5 min intervals)

			for (let i = 0; i < count; i++) {
				const sessionId = `test-session-${i + 1}`;
				const session = {
					id: sessionId,
					createdAt: baseTimestamp + i * 300000,
					duration: 60, // 60 seconds
					blobKey: sessionId,
					thumbnail: previewDataUrl,
					thumbnails: [
						{ time: 0, dataUrl: previewDataUrl },
						{ time: 10, dataUrl: previewDataUrl },
						{ time: 20, dataUrl: previewDataUrl },
						{ time: 30, dataUrl: previewDataUrl },
						{ time: 40, dataUrl: previewDataUrl },
						{ time: 50, dataUrl: previewDataUrl },
					],
					saved: false,
				};

				// Save session
				const sessionsTx = db.transaction(sessionsStore, "readwrite");
				const sessionsStoreObj = sessionsTx.objectStore(sessionsStore);
				sessionsStoreObj.add(session);
				await new Promise<void>((resolve, reject) => {
					sessionsTx.oncomplete = () => resolve();
					sessionsTx.onerror = () => reject(sessionsTx.error);
				});

				// Save blob
				const blobsTx = db.transaction(blobsStore, "readwrite");
				const blobsStoreObj = blobsTx.objectStore(blobsStore);
				blobsStoreObj.add({
					id: sessionId,
					blob: new Blob([videoArrayBuffer], { type: "video/webm" }),
				});
				await new Promise<void>((resolve, reject) => {
					blobsTx.oncomplete = () => resolve();
					blobsTx.onerror = () => reject(blobsTx.error);
				});
			}

			db.close();
		},
		{
			dbName: DB_NAME,
			dbVersion: DB_VERSION,
			sessionsStore: SESSIONS_STORE,
			blobsStore: BLOBS_STORE,
			count: sessionCount,
			videoData: videoBase64,
			previewData: previewBase64,
		},
	);
}

/**
 * Wait for sessions to be loaded in IndexedDB
 */
export async function waitForSessionsLoaded(page: Page, expectedCount: number): Promise<void> {
	await page.waitForFunction(
		async (args) => {
			try {
				const { dbName, sessionsStore, count } = args;
				const db = await new Promise<IDBDatabase | null>(
					(resolve, reject) => {
						const request = indexedDB.open(dbName);
						request.onerror = () => reject(request.error);
						request.onsuccess = () => resolve(request.result);
						request.onupgradeneeded = () => {
							request.result.close();
							resolve(null);
						};
					},
				);
				if (!db) return false;

				const tx = db.transaction(sessionsStore, "readonly");
				const store = tx.objectStore(sessionsStore);
				const actualCount = await new Promise<number>((resolve, reject) => {
					const request = store.count();
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
				db.close();
				return actualCount >= count;
			} catch {
				return false;
			}
		},
		{ dbName: DB_NAME, sessionsStore: SESSIONS_STORE, count: expectedCount },
		{ timeout: 15000 },
	);
}

/**
 * Clear the IndexedDB sessions database.
 */
export async function clearSessionBuffer(page: Page): Promise<void> {
	await page.evaluate(
		async ({ dbName }) => {
			await new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase(dbName);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		},
		{ dbName: DB_NAME },
	);
}
