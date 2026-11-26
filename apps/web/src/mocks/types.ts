import type {
	DestinationDto,
	Frequency,
	GovernanceSettingsDto,
	GroupEventKind,
	GroupStatus,
	LateFeeDto,
	MissedGracePolicy,
	NotificationKind,
	PayoutOrder,
	ProfileDto,
	ProposalStatus,
	ProposalType,
	RecoveryAction,
	ResolutionDto,
	SavingsPlanKind,
	SlotListingStatus,
	SlotTakeoverStatus,
	ThresholdDto,
} from "@/lib/api/dto";

/**
 * The mock backend's tables. Rows hold what the Railway API would hold; `src/mocks/dto.ts` turns
 * them into the DTOs the API returns. Times are ISO strings on the mock clock (`clock.ts`).
 */

/** A simulated member, so one person can run every flow: they pay, vote and ask to join on their own. */
export interface MockBot {
	/** Pays each round shortly after it opens. False = misses it (a default to recover from). */
	pays: boolean;
	/** How they vote on proposals. */
	votes: "yes" | "no";
}

export interface MockUser {
	id: string;
	email: string;
	/** Null for Google-only accounts. */
	password: string | null;
	role: "user" | "admin";
	createdAt: string;
	profile: ProfileDto | null;
	avatarUrl: string | null;
	signInMethods: ("password" | "google")[];
	security: { loginLockout: boolean };
	failedLogins: number;
	lockedUntil: string | null;
	wallet: { publicKey: string; linkedAt: string } | null;
	destinations: DestinationDto[];
	bot?: MockBot;
}

export interface MockSignup {
	email: string;
	password: string;
	signupToken: string;
	code: string;
	expiresAt: string;
	resendAt: string;
	attempts: number;
}

export interface MockRefreshToken {
	token: string;
	userId: string;
	family: string;
	used: boolean;
}

export interface MockCycle {
	startedAt: string;
	/** 0-based current round. */
	round: number;
	/** When the current round opened (its deadline is one interval later). */
	roundStartedAt: string;
	/** Recipient user id per round, first recipient first. */
	schedule: string[];
	paidOut: boolean[];
	paused: { since: string; proposalId: string } | null;
	stateVersion: number;
	escrowAccount: string;
}

export interface MockGroup {
	id: string;
	type: "rotating" | "challenge";
	name: string;
	status: GroupStatus;
	frequency: Frequency;
	customIntervalDays: number | null;
	asset: "USDC";
	targetAmount: string;
	contributionAmount: string;
	lateFee: LateFeeDto | null;
	payoutOrder: PayoutOrder;
	missedGracePolicy: MissedGracePolicy;
	gracePeriodDays: number;
	publicDiscovery: boolean;
	contributionPrivacy: boolean;
	autoApproval: boolean;
	serviceChargePercent: string;
	coverUrl: string | null;
	inviteCode: string;
	createdAt: string;
	governance: GovernanceSettingsDto;
	cycle: MockCycle | null;
	/** People an admin removed while forming: they can't rejoin until the ban is lifted. */
	bans?: string[];
	/** Bots ask to join this forming group a little after it is created (groups made in the app). */
	simulateJoins?: boolean;
}

export interface MockMember {
	groupId: string;
	userId: string;
	role: "admin" | "member";
	joinedAt: string;
	removedAt: string | null;
}

export interface MockJoinRequest {
	groupId: string;
	userId: string;
	requestedAt: string;
}

export interface MockContribution {
	id: string;
	groupId: string;
	round: number;
	userId: string;
	/** What was paid, late fee included. */
	amount: string;
	paidAt: string;
	late: boolean;
	txHash: string;
}

export interface MockPayout {
	id: string;
	groupId: string;
	round: number;
	userId: string;
	amount: string;
	paidAt: string;
	txHash: string;
}

export interface MockDefault {
	id: string;
	groupId: string;
	round: number;
	userId: string;
	amount: string;
	/** End of the grace period that was missed. */
	deadline: string;
	detectedAt: string;
	txHash: string;
	graceUntil: string | null;
	resolution: ResolutionDto | null;
}

export interface MockVote {
	userId: string;
	choice: "yes" | "no";
	at: string;
}

export interface MockProposal {
	id: string;
	groupId: string;
	number: number;
	type: ProposalType;
	description: string;
	proposerId: string;
	threshold: ThresholdDto;
	required: number;
	/** Member ids allowed to vote, fixed at creation. */
	electorate: string[];
	votes: MockVote[];
	status: ProposalStatus;
	createdAt: string;
	votingEndsAt: string;
	executeBy: string | null;
	executedAt: string | null;
	executionTxHash: string | null;
	scheduleChange: { fromRound: number; recipients: string[] } | null;
	recovery: { defaultId: string; action: RecoveryAction; graceUntil: string | null } | null;
}

export interface MockEvent {
	id: string;
	groupId: string;
	kind: GroupEventKind;
	actorId: string | null;
	data: Record<string, unknown>;
	txHash: string | null;
	anchorHash: string | null;
	createdAt: string;
}

export interface MockNotification {
	id: string;
	userId: string;
	kind: NotificationKind;
	title: string;
	body: string;
	data: Record<string, unknown>;
	readAt: string | null;
	createdAt: string;
}

/** A personal savings plan (v3). Balance and withdrawable are derived from its transactions. */
export interface MockSavingsPlan {
	id: string;
	userId: string;
	name: string;
	kind: SavingsPlanKind;
	targetAmount: string;
	targetDate: string | null;
	ownerWallet: string;
	contractId: string;
	createdAt: string;
}

export interface MockSavingsTx {
	id: string;
	planId: string;
	kind: "deposit" | "withdrawal";
	amount: string;
	txHash: string;
	createdAt: string;
}

/** A slot offered for takeover (v3). */
export interface MockSlotListing {
	id: string;
	groupId: string;
	round: number;
	sellerId: string;
	reason: string | null;
	createdAt: string;
	expiresAt: string;
	status: SlotListingStatus;
}

/** A takeover request: its approval vote and, once signed, the transfer itself. */
export interface MockTakeover {
	id: string;
	listingId: string;
	groupId: string;
	round: number;
	fromId: string;
	toId: string;
	toWallet: string;
	requestedAt: string;
	/** Members allowed to review, fixed at request: everyone but the current owner. */
	electorate: string[];
	required: number;
	votes: MockVote[];
	votingEndsAt: string;
	status: SlotTakeoverStatus;
	approvedAt: string | null;
	signBy: string | null;
	transferredAt: string | null;
	txHash: string | null;
}

export interface MockDb {
	version: number;
	users: MockUser[];
	signups: MockSignup[];
	/** Live reset links (one per email; the newest replaces the last). */
	passwordResets: { email: string; token: string; expiresAt: string }[];
	refreshTokens: MockRefreshToken[];
	groups: MockGroup[];
	members: MockMember[];
	joinRequests: MockJoinRequest[];
	contributions: MockContribution[];
	payouts: MockPayout[];
	defaults: MockDefault[];
	proposals: MockProposal[];
	events: MockEvent[];
	notifications: MockNotification[];
	/** USDC held by each simulated wallet (public key → decimal string). */
	walletBalances: Record<string, string>;
	savingsPlans: MockSavingsPlan[];
	savingsTransactions: MockSavingsTx[];
	slotListings: MockSlotListing[];
	slotTakeovers: MockTakeover[];
}
