/**
 * Personal savings plans (`/v1/savings/*`, v3). PROVISIONAL: the API doesn't have these routes yet;
 * the mock serves them (src/mocks/handlers/savings.ts) with the shapes in lib/api/dto.ts.
 */
import { apiGet, apiPost, type Page } from "@/lib/api/client";
import type {
	CreateSavingsPlanDto,
	SavingsDepositDto,
	SavingsPlanDto,
	SavingsSummaryDto,
	SavingsTransactionDto,
	SavingsWithdrawalDto,
} from "@/lib/api/dto";

/** Personal savings across every plan (the dashboard's "Personal savings"). */
export const getSavingsSummary = () => apiGet<SavingsSummaryDto>("/savings/summary");

export const listSavingsPlans = (query: { page?: number; limit?: number } = {}) =>
	apiGet<Page<SavingsPlanDto>>("/savings/plans", query);

/** Needs a linked wallet: it becomes the plan's owner wallet. */
export const createSavingsPlan = (input: CreateSavingsPlanDto) => apiPost<SavingsPlanDto>("/savings/plans", input);

export const getSavingsPlan = (id: string) => apiGet<SavingsPlanDto>(`/savings/plans/${id}`);

export const listSavingsTransactions = (id: string, query: { page?: number; limit?: number } = {}) =>
	apiGet<Page<SavingsTransactionDto>>(`/savings/plans/${id}/transactions`, query);

/** After the wallet paid `amount` to `plan.deposit`: records it with the transaction hash. */
export const recordDeposit = (id: string, input: SavingsDepositDto) =>
	apiPost<SavingsTransactionDto>(`/savings/plans/${id}/deposits`, input);

/** Signed by the owner wallet; the contract releases `amount` to that wallet. 403 while a locked plan is locked. */
export const withdrawSavings = (id: string, input: SavingsWithdrawalDto) =>
	apiPost<SavingsTransactionDto>(`/savings/plans/${id}/withdrawals`, input);
