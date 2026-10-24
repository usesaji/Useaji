/** Governance (`/v1/groups/{id}/governance | proposals | history`). */
import { apiGet, apiPost, apiPut, type Page } from "@/lib/api/client";
import type { CreateProposalDto, GovernanceSettingsDto, GroupEventDto, GroupEventKind, ProposalDto, ProposalStatus } from "@/lib/api/dto";

export const getGovernance = (id: string) => apiGet<GovernanceSettingsDto>(`/groups/${id}/governance`);

/** Admins only, before the cycle starts. */
export const setGovernance = (id: string, input: GovernanceSettingsDto) => apiPut<GovernanceSettingsDto>(`/groups/${id}/governance`, input);

export const createProposal = (id: string, input: CreateProposalDto) => apiPost<ProposalDto>(`/groups/${id}/proposals`, input);

/** `open` = active or approved; `closed` = the rest. */
export type ProposalFilter = ProposalStatus | "open" | "closed";

export const listProposals = (id: string, query: { status?: ProposalFilter; page?: number; limit?: number } = {}) =>
	apiGet<Page<ProposalDto>>(`/groups/${id}/proposals`, query);

export const getProposal = (id: string, proposalId: string) => apiGet<ProposalDto>(`/groups/${id}/proposals/${proposalId}`);

/** One final vote per eligible member. Reaching the threshold approves and executes at once. */
export const vote = (id: string, proposalId: string, choice: "yes" | "no") =>
	apiPost<ProposalDto>(`/groups/${id}/proposals/${proposalId}/votes`, { choice });

/** Retries execution of an approved proposal (e.g. after a network failure). */
export const executeProposal = (id: string, proposalId: string) => apiPost<ProposalDto>(`/groups/${id}/proposals/${proposalId}/execute`);

export interface HistoryQuery {
	kind?: GroupEventKind;
	category?: "governance" | "recovery" | "savings";
	page?: number;
	limit?: number;
}

/** `kind` is comma-separated; `category` is the history tab (both must match when combined). */
export const getHistory = (id: string, query: HistoryQuery = {}) =>
	apiGet<Page<GroupEventDto>>(`/groups/${id}/history`, query);
