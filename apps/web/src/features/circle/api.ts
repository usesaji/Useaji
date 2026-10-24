/** The savings cycle and recovery (`/v1/groups/{id}/start | cycle | contributions | defaults`). */
import { apiGet, apiPost } from "@/lib/api/client";
import type { CycleDto, DefaultDto, DetectResultDto } from "@/lib/api/dto";

/** Admins only, while forming, with at least 2 members. `schedule` (user ids) for manual / custom payout order. */
export const startGroup = (id: string, schedule?: string[]) => apiPost<CycleDto>(`/groups/${id}/start`, schedule ? { schedule } : {});

export const getCycle = (id: string) => apiGet<CycleDto>(`/groups/${id}/cycle`);

/** After paying `CycleDto.payment` from the wallet: the payment's hash. Without one in simulated mode (no `payment`). */
export const recordContribution = (id: string, txHash?: string) => apiPost<CycleDto>(`/groups/${id}/contributions`, txHash ? { txHash } : {});

export const listDefaults = (id: string, status?: "open" | "resolved") => apiGet<DefaultDto[]>(`/groups/${id}/defaults`, { status });

/** Any member may trigger it; the API's scanner also runs it every minute. */
export const detectDefaults = (id: string) => apiPost<DetectResultDto>(`/groups/${id}/defaults/detect`);

/** The member in default pays what they owe (`DefaultDto.amount`). Returns the open defaults left. */
export const settleDefault = (id: string, defaultId: string, txHash?: string) =>
	apiPost<DefaultDto[]>(`/groups/${id}/defaults/${defaultId}/settle`, txHash ? { txHash } : {});
