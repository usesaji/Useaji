// The MVP 2 journey end to end through the real client stack (feature api.ts → axios client with
// token refresh → mock adapter → engine), in Node with a localStorage shim. `pnpm test:mock`.
// The app talks to Railway by default; this journey runs on the mock (and its simulated wallet).
process.env.NEXT_PUBLIC_API_SOURCE ??= "mock";
const store = new Map<string, string>();
const ls = {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => void store.set(k, v),
	removeItem: (k: string) => void store.delete(k),
	clear: () => store.clear(),
	key: () => null,
	length: 0,
};
Object.assign(globalThis, { localStorage: ls, sessionStorage: ls });
Object.assign(globalThis, { window: Object.assign(globalThis, { addEventListener() {}, removeEventListener() {}, location: { origin: "http://localhost:3000" } }) });

let failures = 0;
const ok = (cond: unknown, label: string) => {
	console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
	if (!cond) failures++;
};
const expectError = async (p: Promise<unknown>, status: number, label: string) => {
	try {
		await p;
		ok(false, `${label} (expected ${status}, got success)`);
	} catch (e) {
		const s = (e as { status?: number }).status;
		ok(s === status, `${label} → ${s} ${(e as Error).message}`);
	}
};

async function main() {
	const { useSession } = await import("@/features/auth/session");
	const { toSession } = await import("@/lib/api/client");
	const auth = await import("@/features/auth/api");
	const account = await import("@/features/account/api");
	const groups = await import("@/features/groups/api");
	const circle = await import("@/features/circle/api");
	const gov = await import("@/features/governance/api");
	const wallet = await import("@/features/wallet/api");
	const activity = await import("@/features/activity/api");
	const mockWallet = await import("@/mocks/wallet");
	const { setClockOffset, clockOffset } = await import("@/mocks/clock");

	// ---- auth
	await expectError(auth.login({ email: "demo@usesaji.com", password: "wrong" }), 401, "login with a wrong password");
	const tokens = await auth.login({ email: "demo@usesaji.com", password: "Password1" });
	useSession.getState().setSession({ ...toSession(tokens), method: "password" });
	const me = await account.getAccount();
	ok(me.profile?.firstName === "Ada" && me.wallet, "GET /users/me returns Ada with a linked wallet");

	// token refresh: expire the access token, the next call must refresh and succeed
	useSession.setState({ expiresAt: Date.now() - 1000 });
	const again = await auth.getMe();
	ok(again.id === me.id && useSession.getState().token !== tokens.accessToken, "an expired access token refreshes itself");

	// ---- sign-up flow
	const started = await auth.signup({ email: "new.person@example.com", password: "Password1" });
	await expectError(auth.verifySignup({ email: started.email, signupToken: started.signupToken, code: "0000" }), 400, "wrong sign-up code");
	const fresh = await auth.verifySignup({ email: started.email, signupToken: started.signupToken, code: "1234" });
	ok(!!fresh.accessToken, "sign-up verify signs the new account in");

	// ---- groups
	const list = await groups.listGroups({ limit: 50 });
	ok(list.results.length >= 5 && list.paginationMeta.totalCount === list.results.length, `GET /groups → ${list.results.length} groups, paginated`);
	const byName = (n: string) => list.results.find((g) => g.name === n)!;
	const overview = await groups.getOverview();
	ok(Number(overview.totalPending) > 0, `overview: saved ${overview.totalSaved}, pending ${overview.totalPending}`);
	const discover = await groups.discoverGroups();
	ok(discover.results.length === 2, "discover lists the two public forming groups");

	// ---- contribute to Lagos through the simulated wallet
	const lagos = byName("Lagos Market Ajo");
	let c = await circle.getCycle(lagos.id);
	ok(c.myAmountDue === "50.00" && c.payment?.destination === c.escrowAccount, `Lagos: round ${c.round! + 1}, Ada owes ${c.myAmountDue} to the escrow`);
	await expectError(circle.recordContribution(lagos.id, ""), 400, "contribution without a txHash");
	const hash = await mockWallet.pay(c.payment!, me.wallet!.publicKey);
	c = await circle.recordContribution(lagos.id, hash);
	ok(c.round === 3 && c.recipient?.userId === me.id, "after Ada pays, round 3 paid out and Ada is round 4's recipient");
	ok(c.myAmountDue === "50.00" && c.contributions.some((x) => x.member.userId === me.id), "the recipient pays into their own round too");
	await expectError(circle.recordContribution(lagos.id, hash), 400, "reusing a transaction hash");

	// ---- the deciding vote on Lagos' schedule change
	const props = await gov.listProposals(lagos.id, { status: "open" });
	const change = props.results[0]!;
	ok(change.type === "update_schedule" && change.canVote && change.yes === change.required - 1, `open proposal waits on Ada (${change.yes}/${change.required})`);
	const voted = await gov.vote(lagos.id, change.id, "yes");
	ok(voted.status === "executed" && !!voted.executionTxHash, "Ada's vote approves and executes it");
	await expectError(gov.vote(lagos.id, change.id, "no"), 409, "voting twice");

	// ---- Family Esusu: recovery
	const family = byName("Family Esusu");
	c = await circle.getCycle(family.id);
	const d = c.openDefaults[0]!;
	ok(c.inRecovery && c.actionRequired && d.availableActions.length === 3, `Family in recovery: default on round ${d.round + 1}, actions ${d.availableActions.join("/")}`);
	await expectError(gov.createProposal(family.id, { type: "recovery", description: "x" }), 400, "recovery proposal with a too-short description");
	const rp = await gov.createProposal(family.id, {
		type: "recovery",
		description: "Tunde's salary is late; give him till Friday",
		defaultId: d.id,
		recoveryAction: "grace_extension",
		graceUntil: new Date(Date.now() + 3 * 86_400_000).toISOString(),
	});
	ok(rp.eligible === 3 && rp.required === 2, `recovery electorate excludes the defaulter (${rp.eligible} eligible, ${rp.required} needed)`);
	await expectError(gov.createProposal(family.id, { type: "recovery", description: "another one", defaultId: d.id, recoveryAction: "write_off" }), 409, "a second recovery proposal for the same default");
	setClockOffset(clockOffset() + 5 * 60_000); // bots vote
	let p = await gov.getProposal(family.id, rp.id);
	ok(p.status === "active" && p.yes === 1, `bots stop one short of the threshold (${p.yes}/${p.required})`);
	p = await gov.vote(family.id, rp.id, "yes");
	ok(p.status === "executed", "Ada's vote executes the grace extension");
	setClockOffset(clockOffset() + 2 * 60_000); // Tunde pays
	c = await circle.getCycle(family.id);
	ok(!c.inRecovery && c.round === 1, "Tunde settles after the extension, recovery ends and round 1 pays out");
	const history = await gov.getHistory(family.id, { limit: 50 });
	const kinds = new Set(history.results.map((e) => e.kind));
	ok(["default_recorded", "recovery_started", "proposal_created", "vote_cast", "proposal_approved", "proposal_executed", "default_resolved", "recovery_resolved", "payout_made"].every((k) => kinds.has(k as never)), "history has the whole recovery trail");
	ok(history.results.every((e) => e.txHash && e.txUrl), "every history event has a Stellar transaction link");

	// ---- Office Thrift: resume by vote
	const office = byName("Office Thrift");
	c = await circle.getCycle(office.id);
	ok(!!c.paused, "Office is paused");
	await expectError(gov.createProposal(office.id, { type: "pause", description: "pause again" }), 409, "pausing a paused group");
	const resume = await gov.createProposal(office.id, { type: "resume", description: "The audit is done" });
	setClockOffset(clockOffset() + 5 * 60_000);
	p = await gov.vote(office.id, resume.id, "yes");
	c = await circle.getCycle(office.id);
	ok(p.status === "executed" && !c.paused, "resume executes and the group runs again");

	// ---- Campus Savers: admin approves requests, sets rules, starts with a schedule
	const campus = byName("Campus Savers");
	const requests = await groups.listJoinRequests(campus.id);
	ok(requests.length === 2, "two pending join requests");
	const members = await groups.approveJoinRequest(campus.id, requests[0]!.userId);
	await groups.rejectJoinRequest(campus.id, requests[1]!.userId);
	ok(members.length === 3 && (await groups.listJoinRequests(campus.id)).length === 0, "approve / reject");
	const rules = await gov.setGovernance(campus.id, { thresholdKind: "count", thresholdValue: 2, votingPeriodHours: 48, executionWindowHours: 24 });
	ok(rules.thresholdKind === "count", "approval rules saved while forming");
	c = await circle.startGroup(campus.id); // payoutOrder "vote": join order
	ok(c.status === "active" && c.totalRounds === 3, "Campus started (vote order = join order)");
	await expectError(gov.setGovernance(campus.id, rules), 409, "rules after the start");

	// ---- create a group, bots ask to join
	const created = await groups.createGroup({
		name: "Test Circle",
		frequency: "custom",
		customIntervalDays: 10,
		targetAmount: "100",
		contributionAmount: "20",
		payoutOrder: "manual",
		lateFeePercent: "5",
		gracePeriodDays: 1,
		publicDiscovery: true,
		contributionPrivacy: true,
		autoApproval: false,
		serviceChargePercent: "0",
	});
	ok(created.status === "forming" && created.invite?.url.includes(created.invite.code), "POST /groups (multipart) creates a forming group with an invite link");
	await expectError(groups.createGroup({ name: "x", frequency: "weekly", targetAmount: "1", contributionAmount: "10", payoutOrder: "random", lateFeeFixed: "5", gracePeriodDays: 1, publicDiscovery: false, contributionPrivacy: false, autoApproval: false, serviceChargePercent: "0" }), 400, "invalid group (short name, late fee over 10%)");
	setClockOffset(clockOffset() + 60_000);
	const asks = await groups.listJoinRequests(created.id);
	ok(asks.length >= 2, "bots ask to join a new group");
	const edited = await groups.updateGroup(created.id, { name: "Test Circle (edited)", contributionAmount: "25", lateFeePercent: "0" });
	ok(edited.name === "Test Circle (edited)" && Number(edited.contributionAmount) === 25 && edited.lateFee === null, "PATCH /groups/{id}: only the changed fields, late fee removed");
	await expectError(groups.updateGroup(created.id, { lateFeeFixed: "1", lateFeePercent: "5" }), 400, "fixed and percent late fee together");
	await groups.approveJoinRequest(created.id, asks[0]!.userId);
	const afterRemove = await groups.removeMember(created.id, asks[0]!.userId);
	ok(!afterRemove.some((m) => m.userId === asks[0]!.userId), "admin removes a member while forming");
	await expectError(groups.removeMember(created.id, me.id), 400, "removing yourself");
	await groups.liftBan(created.id, asks[0]!.userId);
	await expectError(groups.liftBan(created.id, asks[0]!.userId), 404, "lifting a ban that isn't there");
	await expectError(groups.leaveGroup(lagos.id), 409, "leaving after the cycle started");
	await expectError(circle.startGroup(created.id), 409, "starting with one member");

	// ---- discover → join a public group; bot admin approves
	const ikeja = discover.results.find((g) => g.name === "Ikeja Traders Circle")!;
	ok((await groups.requestToJoin(ikeja.id)).status === "joined", "auto-approval group joins at once");
	const abuja = discover.results.find((g) => g.name === "Abuja Tech Savers")!;
	ok((await groups.requestToJoin(abuja.id)).status === "requested", "other public group: request sent");
	setClockOffset(clockOffset() + 60_000);
	ok((await groups.getGroup(abuja.id)).myRole === "member", "the bot admin approves the request");

	// ---- wallet (payouts go straight to the payout address), activity, statement, notifications
	const w = await wallet.getWallet();
	ok(Number(w.totalPaidOut) > 0 && w.payoutAddress?.source === "destination", `paid out ${w.totalPaidOut}, payouts go to the primary destination`);
	const newAddress = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
	await expectError(wallet.addDestination({ address: newAddress }), 400, "adding a payout address without the password");
	await expectError(wallet.addDestination({ address: newAddress, currentPassword: "wrong-password" }), 401, "adding one with a wrong password");
	ok(!!useSession.getState().token && (await wallet.getWallet()).wallet !== undefined, "a wrong password doesn't end the session");
	const added = await wallet.addDestination({ address: newAddress, label: "Second", currentPassword: "Password1" });
	await expectError(wallet.setPrimaryDestination(added.id, {}), 400, "making it primary without the password");
	await wallet.setPrimaryDestination(added.id, { currentPassword: "Password1" });
	ok((await wallet.getWallet()).payoutAddress?.address === newAddress, "payouts follow the new primary address");
	const one = (await activity.listActivity({ limit: 1 })).results[0]!;
	ok((await activity.getActivityItem(one.id)).id === one.id && !!one.txUrl, "GET /activity/{id}, with the explorer link");
	const acts = await activity.listActivity({ type: "payout" });
	ok(acts.results.every((a) => a.kind === "payout") && acts.results.length >= 1, "activity filtered to payouts");
	const st = await activity.getStatement({});
	ok(st.transactions.length > 0 && Number(st.totals.contributions) > 0, `statement: ${st.transactions.length} rows`);
	const unread = await activity.unreadCount();
	await activity.markAllRead();
	ok(unread.unread > 0 && (await activity.unreadCount()).unread === 0, `notifications: ${unread.unread} unread, then mark all read`);

	// ---- slot marketplace & takeover (v3, provisional routes)
	const slots = await import("@/features/slots/api");
	const market = await slots.listSlotListings();
	const summerListing = market.results.find((l) => l.group.name === "Summer Fund")!;
	const circleListing = market.results.find((l) => l.group.name === "Community Circle")!;
	ok(summerListing?.status === "pending" && summerListing.slotNumber === 5, "marketplace: Summer Fund slot #5, a request under review");
	ok(circleListing?.status === "open" && circleListing.slotNumber === 7 && circleListing.eligibility?.canRequest === true, "marketplace: Community Circle slot #7, open to Ada");
	ok(circleListing.terms.remainingContributions > 0 && circleListing.terms.schedule.some((d) => d.payout), "a listing shows its remaining schedule and payout round");

	// Ada reviews Dean's request for Amara's slot (she's one of the 5 reviewers; 4 approvals needed).
	let review = summerListing.takeover!;
	ok(review.canVote && review.yes === 3 && review.required === 4 && review.eligible === 5, `Summer Fund takeover: ${review.yes} of ${review.required}, Ada decides`);
	ok(review.checks.every((c) => c.ok), "the incoming member is verified");
	review = await slots.voteOnTakeover(review.id, "yes");
	ok(review.status === "approved" && !review.canVote, "Ada's approval reaches the threshold");
	await expectError(slots.voteOnTakeover(review.id, "no"), 409, "votes are final");
	setClockOffset(clockOffset() + 2 * 60_000);
	review = await slots.getTakeover(review.id);
	ok(review.status === "transferred" && !!review.txHash, "Dean signs: the slot is transferred on Soroban");
	const summer = (await groups.listGroups({ limit: 50 })).results.find((g) => g.name === "Summer Fund")!;
	const summerCycle = await circle.getCycle(summer.id);
	ok(summerCycle.schedule[4]?.member.userId === review.to.userId, "the schedule's slot #5 now belongs to Dean");
	const transfers = await slots.listSlotTransfers(summer.id);
	const dami = transfers.results.find((t) => t.status === "transferred" && t.from.firstName === "Dami")!;
	ok(
		transfers.results.filter((t) => t.status === "transferred").length === 2 && dami.history.some((h) => h.kind === "contribution" && h.member.firstName === "Dami"),
		"transfer history keeps the slot's earlier contributions (Dami → Fatima)",
	);

	// Ada requests Dami's slot in Community Circle, the members approve, Ada signs.
	await expectError(slots.requestTakeover(summerListing.id), 409, "a slot under transfer can't be requested");
	let request = await slots.requestTakeover(circleListing.id);
	ok(request.status === "voting" && request.canWithdraw && !request.canVote, `Ada's request: ${request.required} of ${request.eligible} approvals needed`);
	await expectError(slots.requestTakeover(circleListing.id), 409, "one request at a time per slot");
	await expectError(slots.signTakeover(request.id, "x".repeat(40)), 409, "can't sign before approval");
	setClockOffset(clockOffset() + 10 * 60_000);
	request = await slots.getTakeover(request.id);
	ok(request.status === "approved" && request.canSign, `the members approve (${request.yes} yes, ${request.no} no)`);
	await expectError(slots.signTakeover(request.id, ""), 400, "the transfer needs the wallet's signature");
	request = await slots.signTakeover(request.id, "x".repeat(40));
	ok(request.status === "transferred", "Ada signs and the slot is hers");
	const community = request.group.id;
	const mySlot = await slots.getMySlot(community);
	ok(mySlot.slotNumber === 7 && mySlot.canList === true, "Ada now holds slot #7 in Community Circle");
	const { readDb: snapshot } = await import("@/mocks/db");
	const { paidThisRound } = await import("@/mocks/engine");
	const cc = await circle.getCycle(community);
	const damiId = request.from.userId;
	const paidByDami = snapshot().contributions.filter((x) => x.groupId === community && x.userId === damiId).map((x) => x.round);
	ok(
		paidByDami.length > 0 && paidByDami.every((round) => paidThisRound(snapshot(), community, round, me.id)) && cc.myAmountDue === "100.00",
		`rounds Dami paid (${paidByDami.map((x) => x + 1).join(", ")}) count for Ada's slot; she owes only what's next`,
	);
	// Another member of Community Circle lists their slot: Ada already holds one there.
	const { updateDb } = await import("@/mocks/db");
	const { createListing } = await import("@/mocks/slots");
	const { nowMs } = await import("@/mocks/clock");
	const second = updateDb((db) => {
		const g = db.groups.find((x) => x.id === community)!;
		const seller = g.cycle!.schedule.find((id, i) => i === g.cycle!.schedule.length - 1)!;
		return createListing(db, g, seller, { expiresAt: new Date(nowMs() + 3 * 86_400_000).toISOString() }, new Date(nowMs()).toISOString());
	});
	await expectError(slots.requestTakeover(second.id), 409, "duplicate ownership: a second slot in the same group is refused");

	// Ada lists her own slot in Summer Fund.
	await expectError(slots.createSlotListing(summer.id, { expiresAt: new Date(Date.now() - 86_400_000).toISOString() }), 400, "a listing must end in the future");
	const own = await slots.createSlotListing(summer.id, { expiresAt: new Date(Date.now() + clockOffset() + 5 * 86_400_000).toISOString(), reason: "Testing" });
	ok(own.mine && own.status === "open" && own.slotNumber === 6, "Ada lists her slot #6");
	await expectError(slots.requestTakeover(own.id), 409, "you can't request your own slot");
	await expectError(slots.createSlotListing(summer.id, { expiresAt: own.expiresAt }), 409, "one listing per slot");
	const cancelled = await slots.cancelSlotListing(own.id);
	ok(cancelled.status === "cancelled", "Ada cancels the listing; the slot stays hers");

	// ---- a missed contribution of Ada's own, then she settles it
	setClockOffset(clockOffset() + 30 * 86_400_000);
	const lagosNow = await circle.getCycle(lagos.id);
	const mine = lagosNow.openDefaults.find((x) => x.member.userId === me.id);
	if (mine) {
		const h = await mockWallet.pay({ destination: lagosNow.escrowAccount!, amount: mine.amount, assetCode: "USDC", assetIssuer: null, memo: "m" }, me.wallet!.publicKey);
		const left = await circle.settleDefault(lagos.id, mine.id, h);
		ok(!left.some((x) => x.id === mine.id), "Ada settles her own missed contribution");
	} else ok(false, "expected Ada to default after skipping 30 days");

	// ---- personal savings (v3, provisional routes; the clock is 30 days on from here)
	const savings = await import("@/features/savings/api");
	const plans = await savings.listSavingsPlans();
	const travel = plans.results.find((p) => p.name === "Travel fund")!;
	const laptop = plans.results.find((p) => p.name === "Laptop fund")!;
	ok(travel?.kind === "flexible" && travel.balance === "1200.00" && travel.progressPercent === 40, "Travel fund: flexible, 1,200 of 3,000 (40%)");
	ok(laptop?.kind === "locked" && laptop.withdrawable === "0.00" && !!laptop.unlocksAt, "Laptop fund: locked, nothing withdrawable");
	const sum = await savings.getSavingsSummary();
	ok(sum.totalSaved === "2000.00" && sum.activePlans === 2, `savings summary: ${sum.totalSaved} in ${sum.activePlans} plans`);

	await expectError(savings.createSavingsPlan({ name: "Rent", kind: "locked", targetAmount: "500" }), 400, "a locked plan needs a release date");
	await expectError(savings.createSavingsPlan({ name: "Travel fund", kind: "flexible", targetAmount: "100" }), 409, "plan names are unique per person");
	const rent = await savings.createSavingsPlan({ name: "Rent", kind: "flexible", targetAmount: "100.00" });
	ok(rent.balance === "0.00" && rent.ownerWallet === me.wallet!.publicKey && !!rent.deposit, "a new plan is owned by the linked wallet");

	const before = Number((await mockWallet.usdcBalance(me.wallet!.publicKey)).usdc);
	const depHash = await mockWallet.pay({ ...rent.deposit!, amount: "10.00" }, me.wallet!.publicKey);
	await expectError(savings.recordDeposit(rent.id, { amount: "10.00" }), 400, "a deposit needs its transaction hash");
	await savings.recordDeposit(rent.id, { amount: "10.00", txHash: depHash });
	await expectError(savings.recordDeposit(rent.id, { amount: "10.00", txHash: depHash }), 409, "a deposit hash can't be reused");
	const rentNow = await savings.getSavingsPlan(rent.id);
	ok(rentNow.balance === "10.00" && rentNow.progressPercent === 10, "deposit lands: 10.00 saved (10%)");

	await expectError(savings.withdrawSavings(rent.id, { amount: "11.00", signature: "x".repeat(40) }), 400, "can't withdraw more than the balance");
	await expectError(savings.withdrawSavings(rent.id, { amount: "4.00", signature: "" }), 400, "a withdrawal needs the owner wallet's signature");
	await savings.withdrawSavings(rent.id, { amount: "4.00", signature: "x".repeat(40) });
	const after = Number((await mockWallet.usdcBalance(me.wallet!.publicKey)).usdc);
	ok((await savings.getSavingsPlan(rent.id)).balance === "6.00" && Math.abs(after - (before - 10 + 4)) < 1e-6, "flexible withdrawal goes back to the owner wallet");
	const planTxs = await savings.listSavingsTransactions(rent.id);
	ok(planTxs.results.length === 2 && planTxs.results[0]!.kind === "withdrawal", "plan history: the withdrawal, then the deposit");

	await expectError(savings.withdrawSavings(laptop.id, { amount: "1.00", signature: "x".repeat(40) }), 403, "a locked plan refuses withdrawals before its date");
	setClockOffset(clockOffset() + 6 * 86_400_000);
	const released = await savings.getSavingsPlan(laptop.id);
	ok(released.withdrawable === "800.00", "after the release date the locked plan's balance is withdrawable");
	await savings.withdrawSavings(laptop.id, { amount: "800.00", signature: "x".repeat(40) });
	ok((await savings.getSavingsPlan(laptop.id)).balance === "0.00", "the released plan can be withdrawn in full");

	await expectError(groups.getGroup("00000000-0000-0000-0000-000000000000"), 404, "unknown group");

	// ---- forgot / reset password (the mock keeps the emailed link in its DB)
	const forgot = await auth.forgotPassword("demo@usesaji.com");
	ok(forgot.resendAvailableIn > 0, "forgot password: link sent");
	ok((await auth.forgotPassword("nobody@example.com")).expiresIn > 0, "same answer for an unknown email");
	const { readDb } = await import("@/mocks/db");
	const link = readDb().passwordResets.find((r) => r.email === "demo@usesaji.com")!;
	await expectError(auth.resetPassword({ email: "demo@usesaji.com", token: "x".repeat(43), newPassword: "NewPass123" }), 400, "reset with a wrong token");
	await auth.resetPassword({ email: "demo@usesaji.com", token: link.token, newPassword: "NewPass123" });
	await expectError(auth.resetPassword({ email: "demo@usesaji.com", token: link.token, newPassword: "NewPass456" }), 400, "a reset link works once");
	ok(!!(await auth.login({ email: "demo@usesaji.com", password: "NewPass123" })).accessToken, "sign in with the new password");
	useSession.getState().clear();
	await expectError(groups.listGroups(), 401, "signed out");

	console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
	process.exit(failures ? 1 : 0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
