import { useSyncExternalStore } from "react";
import { USE_MOCK_API } from "@/lib/api/source";

/** The dev panel's "skip ahead" (mocks/clock.ts), so countdowns agree with the mock's data. */
const MOCK_CLOCK_KEY = "saji-mock-clock";

function offset() {
	if (!USE_MOCK_API) return 0;
	try {
		return Number(localStorage.getItem(MOCK_CLOCK_KEY)) || 0;
	} catch {
		return 0;
	}
}

/** Now, in ms, on the same clock as the data (the mock's, while the API is mocked). */
export const currentTime = () => Date.now() + offset();

/**
 * The current time, ticking every `intervalMs` (countdowns, "in 3 days"). Render stays pure: the
 * value comes from a subscription, never from calling Date.now() while rendering. 0 on the server.
 */
export function useNow(intervalMs = 30_000) {
	return useSyncExternalStore(
		(onChange) => {
			const id = setInterval(onChange, intervalMs);
			window.addEventListener("storage", onChange);
			return () => {
				clearInterval(id);
				window.removeEventListener("storage", onChange);
			};
		},
		() => Math.floor(currentTime() / intervalMs) * intervalMs,
		() => 0,
	);
}
