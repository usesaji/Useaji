import { setClockOffset } from "@/mocks/clock";
import { seed } from "@/mocks/seed";
import type { MockDb } from "@/mocks/types";

/**
 * The in-browser mock backend: one JSON document in localStorage, so data survives reloads.
 * Reads are deep copies (mutating a result never changes the store); writes go through
 * `updateDb`. `resetMockDb()` restores the seed. Bump VERSION when the shape changes: older
 * documents are replaced by a fresh seed.
 */

const KEY = "saji-mock-db";
const VERSION = 6;

let memory: MockDb | null = null;

function load(): MockDb {
	if (memory) return memory;
	try {
		const raw = localStorage.getItem(KEY);
		const parsed = raw ? (JSON.parse(raw) as MockDb) : null;
		memory = parsed && parsed.version === VERSION ? parsed : seed(VERSION);
	} catch {
		memory = seed(VERSION); // storage blocked: lives in memory only
	}
	return memory;
}

function save(db: MockDb) {
	try {
		localStorage.setItem(KEY, JSON.stringify(db));
	} catch (error) {
		// Full storage would silently lose the write (uploaded images make this possible): say so.
		if (error instanceof DOMException && error.name === "QuotaExceededError") {
			throw new Error("Your browser storage is full. Reset the demo data or use smaller images, then try again.");
		}
		// Storage blocked (privacy settings): keep the in-memory copy only.
	}
	memory = db;
}

export function readDb(): MockDb {
	return structuredClone(load());
}

export function updateDb<T>(change: (db: MockDb) => T): T {
	const db = structuredClone(load());
	const result = change(db);
	save(db);
	return structuredClone(result);
}

/** Back to the seed, on the real clock. */
export function resetMockDb() {
	setClockOffset(0);
	save(seed(VERSION));
}

// Another tab wrote: drop the cached copy so the next read sees it.
if (typeof window !== "undefined") {
	window.addEventListener("storage", (event) => {
		if (event.key === KEY) memory = null;
	});
}
