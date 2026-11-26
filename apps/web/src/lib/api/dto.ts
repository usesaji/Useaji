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

// personal savings (v3): plans in the personal savings contract, and the savings dashboard
export type PlanDto = S["PlanDto"];
export type MovementDto = S["MovementDto"];
export type CreatePlanDto = S["CreatePlanDto"];
export type PreparedPlanDto = S["PreparedPlanDto"];
/** `{ signedXdr }` or `{ txHash }` once the wallet signed; `{ amount }` alone in simulated mode. */
export type ConfirmDto = S["ConfirmDto"];
export type AmountDto = S["AmountDto"];
export type SavingsTotalsDto = S["SavingsTotalsDto"];
export type SavingsDashboardDto = S["SavingsDashboardDto"];
/** An unsigned transaction the API built for the caller's wallet. */
export type PreparedTransactionDto = S["PreparedTransactionDto"];

// slot marketplace (v3): listings, takeover requests, the accept, transfer history
export type ListingDto = S["ListingDto"];
export type ListingGroupDto = S["ListingGroupDto"];
export type ListingTransferDto = S["ListingTransferDto"];
export type ListingApprovalDto = S["ListingApprovalDto"];
export type TakeoverRequestDto = S["TakeoverRequestDto"];
export type CreateListingDto = S["CreateListingDto"];
export type AcceptTransferDto = S["AcceptTransferDto"];
export type MyListingsDto = S["MyListingsDto"];
export type SlotTransferDto = S["SlotTransferDto"];
export type SlotTransferDetailDto = S["SlotTransferDetailDto"];
export type SlotPayoutDto = S["SlotPayoutDto"];
export type SlotPaidDto = S["SlotPaidDto"];
/** Can you do it now: each rule, and the message the API would answer if it fails. */
export type EligibilityDto = S["EligibilityDto"];
export type EligibilityCheckDto = S["EligibilityCheckDto"];
/** Listing your slot: the checks, and your slot's 0-based `position` (null when you hold none). */
export type SellerEligibilityDto = S["SellerEligibilityDto"];

// test USDC faucet (testnet only; 404 when it's off)
export type PreparedTrustlineDto = S["PreparedTrustlineDto"];
export type FaucetFundedDto = S["FaucetFundedDto"];

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
export type SavingsLock = PlanDto["lock"];
export type ListingStatus = ListingDto["status"];

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
