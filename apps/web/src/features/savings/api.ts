/**
 * Personal savings (`/v1/savings/*`, v3): goals in the personal savings contract, and the savings
 * dashboard. Money moves in three steps (docs/frontend-integration.md §2): `…/prepare` returns an
 * unsigned transaction for the owner wallet, the wallet signs it, the confirm call submits it.
 */
import { apiGet, apiPost } from "@/lib/api/client";
import type { AmountDto, ConfirmDto, CreatePlanDto, PlanDto, PreparedPlanDto, PreparedTransactionDto, SavingsDashboardDto } from "@/lib/api/dto";

/** Group savings (as `GET /groups/overview`), personal savings, and both together. */
export const getSavingsOverview = () => apiGet<SavingsDashboardDto>("/savings/overview");

/** Newest first, without `movements`. */
export const listSavingsPlans = () => apiGet<PlanDto[]>("/savings/plans");

/** With its last 100 movements, newest first. Someone else's plan is a 404. */
export const getSavingsPlan = (id: string) => apiGet<PlanDto>(`/savings/plans/${id}`);

/** Stellar: `xdr` to sign, then `confirmSavingsPlan`. Simulated: `xdr` is null and `plan` is created. */
export const createSavingsPlan = (input: CreatePlanDto) => apiPost<PreparedPlanDto>("/savings/plans", input);

/** The plan id is reserved for 24 hours; confirming twice returns the same plan. */
export const confirmSavingsPlan = (planId: string, input: ConfirmDto) => apiPost<PlanDto>(`/savings/plans/${planId}/confirm`, input);

export const prepareDeposit = (id: string, input: AmountDto) => apiPost<PreparedTransactionDto>(`/savings/plans/${id}/deposits/prepare`, input);

/** `{ signedXdr }` after the wallet signed; `{ amount }` alone in simulated mode. */
export const confirmDeposit = (id: string, input: ConfirmDto) => apiPost<PlanDto>(`/savings/plans/${id}/deposits`, input);

/** 409 while the lock holds (the message says until when), above the balance, or from another wallet. */
export const prepareWithdrawal = (id: string, input: AmountDto) => apiPost<PreparedTransactionDto>(`/savings/plans/${id}/withdrawals/prepare`, input);

export const confirmWithdrawal = (id: string, input: ConfirmDto) => apiPost<PlanDto>(`/savings/plans/${id}/withdrawals`, input);
