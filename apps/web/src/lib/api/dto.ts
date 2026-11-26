import type { components } from "./schema";

/**
 * The Railway API's DTOs, by name. `schema.d.ts` is generated from docs/openapi.json
 * (`pnpm --filter web api:types`); refresh the spec from `<api>/docs-json`, regenerate, and
 * TypeScript shows every screen a backend change breaks. Screens read these shapes directly, so
 * the mock (src/mocks) has to produce them exactly.
 */
type S = components["schemas"];

// auth & account
export type AuthTokensDto = S["AuthTokensDto"];
export type SignupStartedDto = S["SignupStartedDto"];
export type OtpResentDto = S["OtpResentDto"];
export type MeDto = S["MeDto"];
export type AccountDto = S["AccountDto"];
export type ProfileDto = S["ProfileDto"];
export type UpdateProfileDto = S["UpdateProfileDto"];
export type AvatarDto = S["AvatarDto"];
export type SecuritySettingsDto = S["SecuritySettingsDto"];
export type UpdateSecuritySettingsDto = S["UpdateSecuritySettingsDto"];
export type SetPasswordDto = S["SetPasswordDto"];
export type ForgotPasswordDto = S["ForgotPasswordDto"];
export type ResetPasswordDto = S["ResetPasswordDto"];
export type PasswordResetStartedDto = S["PasswordResetStartedDto"];
/** `currentPassword`, or `googleIdToken` for Google-only accounts: changes to where money goes. */
export type ReauthDto = S["ReauthDto"];

// wallet
export type WalletSummaryDto = S["WalletSummaryDto"];
export type WalletInsightsDto = S["WalletInsightsDto"];
export type LinkedWalletDto = S["LinkedWalletDto"];
export type WalletChallengeDto = S["WalletChallengeDto"];
export type DestinationDto = S["DestinationDto"];
export type AddDestinationDto = S["AddDestinationDto"];
export type PayoutAddressDto = S["PayoutAddressDto"];

// groups
export type GroupSummaryDto = S["GroupSummaryDto"];
export type GroupDetailDto = S["GroupDetailDto"];
export type GroupsOverviewDto = S["GroupsOverviewDto"];
export type NextDueDto = S["NextDueDto"];
export type UpdateGroupDto = S["UpdateGroupDto"];
export type MemberPreviewDto = S["MemberPreviewDto"];
export type MemberDto = S["MemberDto"];
export type JoinRequestDto = S["JoinRequestDto"];
export type JoinResultDto = S["JoinResultDto"];
export type InviteDto = S["InviteDto"];
export type CoverDto = S["CoverDto"];
export type LateFeeDto = S["LateFeeDto"];

// savings cycle & recovery
export type CycleDto = S["CycleDto"];
export type RoundContributionDto = S["RoundContributionDto"];
export type ScheduleSlotDto = S["ScheduleSlotDto"];
export type PaymentInstructionsDto = S["PaymentInstructionsDto"];
export type ChainSyncDto = S["ChainSyncDto"];
export type PauseDto = S["PauseDto"];
export type DefaultDto = S["DefaultDto"];
export type ResolutionDto = S["ResolutionDto"];
export type DetectResultDto = S["DetectResultDto"];

// governance
export type GovernanceSettingsDto = S["GovernanceSettingsDto"];
export type ProposalDto = S["ProposalDto"];
export type CreateProposalDto = S["CreateProposalDto"];
export type ThresholdDto = S["ThresholdDto"];
export type ScheduleChangeDto = S["ScheduleChangeDto"];
export type RecoveryDetailDto = S["RecoveryDetailDto"];
export type GroupEventDto = S["GroupEventDto"];

// activity & notifications
export type ActivityItemDto = S["ActivityItemDto"];
export type StatementDto = S["StatementDto"];
export type NotificationDto = S["NotificationDto"];
export type UnreadCountDto = S["UnreadCountDto"];
export type ErrorResponseDto = S["ErrorResponseDto"];

// enums the screens switch on
export type GroupStatus = GroupDetailDto["status"];
export type Frequency = GroupDetailDto["frequency"];
export type PayoutOrder = GroupDetailDto["payoutOrder"];
export type MissedGracePolicy = GroupDetailDto["missedGracePolicy"];
export type ProposalType = ProposalDto["type"];
export type ProposalStatus = ProposalDto["status"];
export type RecoveryAction = DefaultDto["availableActions"][number];
export type GroupEventKind = GroupEventDto["kind"];
export type NotificationKind = NotificationDto["kind"];
export type ActivityKind = ActivityItemDto["kind"];

// ---------------------------------------------------------------------------------------------
// PROVISIONAL — v3 personal savings. Not in docs/openapi.json yet: written from the designs and
// served by the mock (src/mocks/handlers/savings.ts, every route `notInApi`). When the backend
// ships these, replace each with its `S["…"]` alias above and let the type errors show the gaps.
// ---------------------------------------------------------------------------------------------

/** Flexible: withdraw any time, up to the balance. Locked: nothing leaves before `unlocksAt`. */
export type SavingsPlanKind = "flexible" | "locked";

/** A personal savings goal, held by its own savings contract on Stellar Testnet. */
export interface SavingsPlanDto {
	id: string;
	name: string;
	kind: SavingsPlanKind;
	asset: "USDC";
	targetAmount: string;
	/** Flexible: the goal date (optional). Locked: the release date (same as `unlocksAt`). */
	targetDate: string | null;
	/** Deposits minus withdrawals. */
	balance: string;
	/** What may leave now: the balance (flexible, or locked after release), else "0.00". */
	withdrawable: string;
	/** Locked plans: when withdrawals open. Null for flexible plans. */
	unlocksAt: string | null;
	/** 0–100: balance against the target. */
	progressPercent: number;
	/** The wallet that owns the plan: deposits come from it, withdrawals only ever go back to it. */
	ownerWallet: string;
	/** The plan's savings contract; null while simulated. */
	contractId: string | null;
	/** Where a deposit pays (the saver picks the amount); null = simulated, the API records it directly. */
	deposit: Omit<PaymentInstructionsDto, "amount"> | null;
	status: "active" | "closed";
	createdAt: string;
}

export interface SavingsTransactionDto {
	id: string;
	planId: string;
	kind: "deposit" | "withdrawal";
	amount: string;
	asset: "USDC";
	/** Null when simulated. */
	txHash: string | null;
	createdAt: string;
}

/** Personal savings across every plan, for the dashboard. */
export interface SavingsSummaryDto {
	asset: "USDC";
	totalSaved: string;
	withdrawable: string;
	activePlans: number;
}

export interface CreateSavingsPlanDto {
	name: string;
	kind: SavingsPlanKind;
	targetAmount: string;
	/** Required for locked plans (the release date); optional for flexible ones. */
	targetDate?: string;
}

/** `POST /savings/plans/{id}/deposits`: the wallet paid `amount` to `plan.deposit`; `txHash` proves it. */
export interface SavingsDepositDto {
	amount: string;
	txHash?: string;
}

/** `POST /savings/plans/{id}/withdrawals`: signed by the owner wallet; funds go to `ownerWallet`. */
export interface SavingsWithdrawalDto {
	amount: string;
	signature: string;
}

// ---------------------------------------------------------------------------------------------
// PROVISIONAL — v3 slot marketplace & takeover. Not in docs/openapi.json yet: written from the
// designs, served by the mock (src/mocks/handlers/slots.ts, every route `notInApi`). A slot is one
// round of a running group's payout schedule; its owner receives that round's payout.
// ---------------------------------------------------------------------------------------------

/** open → pending (a takeover request is under review) → transferred; or cancelled / expired. */
export type SlotListingStatus = "open" | "pending" | "transferred" | "cancelled" | "expired";

/** voting → approved (the incoming member signs) → transferred; or rejected / expired / withdrawn. */
export type SlotTakeoverStatus = "voting" | "approved" | "transferred" | "rejected" | "expired" | "withdrawn";

/** One eligibility condition and whether it holds ("Payout has not been received" · ok). */
export interface SlotCheckDto {
	label: string;
	ok: boolean;
}

/** One remaining round for the slot's owner: a contribution due, and the round that pays the slot. */
export interface SlotDueDto {
	/** 0-based, as `CycleDto.round`. */
	round: number;
	dueAt: string;
	amount: string;
	/** This round pays out to the slot's owner. */
	payout: boolean;
}

/** What owning the slot means from now on: what the new owner takes over. */
export interface SlotTermsDto {
	contributionAmount: string;
	frequency: Frequency;
	customIntervalDays: number | null;
	/** Contributions still to pay (the current round counts until it's paid). */
	remainingContributions: number;
	remainingAmount: string;
	/** Expected payout: everyone's contribution for the slot's round, after the service charge. */
	payoutAmount: string;
	payoutAt: string;
	lastContributionAt: string | null;
	schedule: SlotDueDto[];
}

export interface SlotGroupDto {
	id: string;
	name: string;
	memberCount: number;
	totalRounds: number;
	asset: "USDC";
}

/** A slot offered for takeover (the marketplace, one listing). */
export interface SlotListingDto {
	id: string;
	status: SlotListingStatus;
	group: SlotGroupDto;
	/** 0-based round; `slotNumber` = round + 1. */
	round: number;
	slotNumber: number;
	seller: MemberPreviewDto;
	reason: string | null;
	createdAt: string;
	expiresAt: string;
	terms: SlotTermsDto;
	/** The caller listed it. */
	mine: boolean;
	/** What a request would need now: approvals out of the members who review (all but the seller). */
	approval: { required: number; eligible: number };
	/** For anyone but the seller: may they request it, and which conditions hold. */
	eligibility: { canRequest: boolean; checks: SlotCheckDto[] } | null;
	/** The request under review or awaiting signature (seen by the seller, the requester and members). */
	takeover: SlotTakeoverDto | null;
}

/** One line of a slot's preserved history: contributions made by its owners, and its payout. */
export interface SlotHistoryItemDto {
	kind: "contribution" | "payout";
	member: MemberPreviewDto;
	amount: string;
	at: string;
	/** A payout that hasn't happened yet. */
	scheduled: boolean;
	txHash: string | null;
}

/** A request to take over a slot, its group approval and (once signed) the ownership transfer. */
export interface SlotTakeoverDto {
	id: string;
	listingId: string;
	status: SlotTakeoverStatus;
	group: SlotGroupDto;
	round: number;
	slotNumber: number;
	from: MemberPreviewDto;
	to: MemberPreviewDto;
	/** The incoming member's wallet: it signs the transfer. */
	toWallet: string;
	requestedAt: string;
	votingEndsAt: string;
	/** Approvals needed (the group's threshold over `eligible`). */
	required: number;
	/** Members who may review: everyone but the current owner. */
	eligible: number;
	yes: number;
	no: number;
	myVote: "yes" | "no" | null;
	canVote: boolean;
	/** The incoming member, once approved and before `signBy`. */
	canSign: boolean;
	/** The incoming member, while voting. */
	canWithdraw: boolean;
	/** "Incoming member verified": wallet, no slot in this group yet, entry conditions. */
	checks: SlotCheckDto[];
	approvedAt: string | null;
	signBy: string | null;
	transferredAt: string | null;
	/** The Soroban transfer; null until transferred (or when simulated). */
	txHash: string | null;
	terms: SlotTermsDto;
	history: SlotHistoryItemDto[];
}

/** `GET /groups/{id}/slot`: the caller's own slot in a running group, and whether they may list it. */
export interface MySlotDto {
	round: number;
	slotNumber: number;
	totalRounds: number;
	paidOut: boolean;
	terms: SlotTermsDto;
	canList: boolean;
	checks: SlotCheckDto[];
	/** The open (or pending) listing for this slot. */
	listing: SlotListingDto | null;
}

export interface CreateSlotListingDto {
	expiresAt: string;
	reason?: string;
}

/**
 * `POST /groups` (multipart). The spec types five of CreateGroupDto's fields as `object`
 * (gracePeriodDays, publicDiscovery, contributionPrivacy, autoApproval, serviceChargePercent),
 * a decorator slip on the backend; this is what the endpoint actually takes. See
 * docs/BACKEND-GAPS.md.
 */
export interface CreateGroupInput {
	name: string;
	asset?: "USDC";
	frequency: Frequency;
	customIntervalDays?: number;
	targetAmount: string;
	contributionAmount: string;
	payoutOrder: PayoutOrder;
	missedGracePolicy?: MissedGracePolicy;
	lateFeeFixed?: string;
	lateFeePercent?: string;
	gracePeriodDays: number;
	publicDiscovery: boolean;
	contributionPrivacy: boolean;
	autoApproval: boolean;
	serviceChargePercent: string;
	coverPhoto?: File | null;
}
