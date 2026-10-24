/**
 * Where data comes from (`NEXT_PUBLIC_API_SOURCE`): the Railway API by default, through this app's
 * `/api/v1` proxy (next.config.ts). `mock` answers every admin route from the in-browser mock
 * (`src/mocks`) — demos without an admin account.
 */
export const USE_MOCK_API = process.env.NEXT_PUBLIC_API_SOURCE === "mock";
