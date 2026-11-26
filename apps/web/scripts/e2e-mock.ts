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

	// ---- slot marketplace (v3: list → request → the seller picks → the group votes → the buyer accepts)
	const slots = await import("@/features/slots/api");
	const market = await slots.listMarketplace();
	const summerListing = market.results.find((l) => l.group.name === "Summer Fund")!;
	const circleListing = market.results.find((l) => l.group.name === "Community Circle")!;
	ok(
		summerListing?.position === 4 && summerListing.askingPrice === "50.00" && summerListing.transfer?.proposalStatus === "active",
		"marketplace: Summer Fund slot 5 for 50 USDC, its buyer is being voted on",
	);
	ok(
		circleListing?.position === 6 && circleListing.askingPrice === "20.00" && circleListing.buyerEligibility?.eligible === true && !circleListing.transfer,
		"marketplace: Community Circle slot 7 for 20 USDC, open to Ada",
	);
	ok(
		circleListing.roundsToPay > 0 && Number(circleListing.remainingObligation) === circleListing.roundsToPay * 100 && circleListing.requests === null,
		`a listing shows what's left to pay (${circleListing.roundsToPay} rounds); requests are the seller's only`,
	);
	ok((await slots.listMarketplace({ search: "summer" })).results.every((l) => l.group.name === "Summer Fund"), "search matches part of the group name");
	ok((await slots.listMarketplace({ maxPrice: "30" })).results.every((l) => Number(l.askingPrice) <= 30), "the price filter runs on the server");
	await expectError(slots.listMarketplace({ minPrice: "50", maxPrice: "10" }), 400, "minPrice above maxPrice");

	// Ada votes on Dean taking Amara's slot (she's one of 5 voters; 4 approvals needed).
	const summer = (await groups.listGroups({ limit: 50 })).results.find((g) => g.name === "Summer Fund")!;
	let transferVote = await gov.getProposal(summer.id, summerListing.transfer!.proposalId);
	ok(
		transferVote.type === "slot_transfer" &&
			transferVote.canVote &&
			transferVote.slotTransfer?.position === 4 &&
			transferVote.slotTransfer.seller.firstName === "Amara" &&
			transferVote.slotTransfer.buyer.firstName === "Dean" &&
			transferVote.slotTransfer.price === "50.00",
		"the vote is a slot_transfer proposal: slot 5, Amara → Dean, 50 USDC",
	);
	ok(transferVote.yes === 3 && transferVote.required === 4 && transferVote.eligible === 5, `${transferVote.yes} of ${transferVote.required}: Ada decides`);
	await gov.vote(summer.id, transferVote.id, "yes");
	transferVote = await gov.getProposal(summer.id, transferVote.id);
	ok(transferVote.status === "executed", "Ada's vote passes it and the approval is created");
	await expectError(gov.vote(summer.id, transferVote.id, "no"), 409, "votes are final");
	await expectError(gov.createProposal(summer.id, { type: "slot_transfer" as never, description: "Sell slot 2 to me" }), 400, "slot transfers can't be proposed directly");
	setClockOffset(clockOffset() + 2 * 60_000);
	ok((await slots.getListing(summerListing.id)).status === "sold", "Dean accepts: the slot is sold");
	const summerCycle = await circle.getCycle(summer.id);
	ok(summerCycle.schedule[4]?.member.firstName === "Dean", "the schedule's slot 5 now belongs to Dean");
	const transfers = await slots.listSlotTransfers(summer.id);
	const fromDami = transfers.find((t) => t.from.firstName === "Dami");
	ok(
		transfers.length === 2 && transfers[0]!.from.firstName === "Amara" && transfers[0]!.price === "50.00" && !!transfers[0]!.txUrl,
		"transfer history: Amara → Dean for 50 USDC, newest first, with its transaction",
	);
	ok(!!fromDami && fromDami.price === "0.00" && fromDami.paidBySeller.rounds > 0, `the earlier free Dami → Fatima, with the ${fromDami?.paidBySeller.rounds} rounds Dami paid in`);

	// Ada asks for Dami's slot in Community Circle; Dami picks her, the members approve, Ada accepts.
	const owner = me.wallet!.publicKey;
	const walletBefore = Number((await mockWallet.usdcBalance(owner)).savings.usdc);
	let asked = await slots.requestTakeover(circleListing.id);
	ok(asked.requested && asked.buyerEligibility?.checks.find((c) => c.key === "notRequested")?.ok === false, "Ada asks for slot 7");
	ok((await slots.requestTakeover(circleListing.id)).requested, "asking again is a no-op");
	ok((await slots.getMyListings()).buying.some((l) => l.id === circleListing.id), "it's under My listings & requests");
	await expectError(slots.prepareAccept(circleListing.id), 404, "nothing to accept before the group approves");
	setClockOffset(clockOffset() + 10 * 60_000);
	asked = await slots.getListing(circleListing.id);
	ok(
		asked.transfer?.buyer.userId === me.id && asked.transfer.proposalStatus === "executed" && asked.transfer.approval?.acceptable === true,
		"Dami puts Ada to the vote and the members approve",
	);
	const stale = await slots.prepareAccept(circleListing.id);
	const staleSigned = await mockWallet.signTransaction(stale.xdr, owner);
	setClockOffset(clockOffset() + 3 * 60_000);
	await expectError(slots.acceptListing(circleListing.id, { signedXdr: staleSigned }), 400, "the co-signature lasts about 2 minutes");
	const signedAccept = await mockWallet.signTransaction((await slots.prepareAccept(circleListing.id)).xdr, owner);
	const bought = await slots.acceptListing(circleListing.id, { signedXdr: signedAccept });
	ok(bought.status === "sold", "Ada accepts: one signature, the slot is hers");
	ok((await slots.acceptListing(circleListing.id, { signedXdr: signedAccept })).status === "sold", "repeating the accept returns the same result");
	ok(Math.abs(walletBefore - 20 - Number((await mockWallet.usdcBalance(owner)).savings.usdc)) < 1e-6, "she paid the 20 USDC asking price");
	const community = bought.group.id;
	const cc = await circle.getCycle(community);
	const myRow = cc.contributions.find((x) => x.member.userId === me.id);
	ok(cc.schedule[6]?.member.userId === me.id, "Ada now holds slot 7 in Community Circle");
	ok(
		!!myRow && (myRow.coveredByPreviousHolder ? myRow.paid && cc.myAmountDue === null : cc.myAmountDue !== null),
		myRow?.coveredByPreviousHolder ? "Dami had paid this round: it counts for Ada (paid by previous holder)" : "Ada owes this round",
	);
	const { readDb: snapshot } = await import("@/mocks/db");
	const { paidThisRound } = await import("@/mocks/engine");
	const damiId = bought.seller.userId;
	const paidByDami = snapshot().contributions.filter((x) => x.groupId === community && x.userId === damiId).map((x) => x.round);
	ok(
		paidByDami.length > 0 && paidByDami.every((round) => paidThisRound(snapshot(), community, round, me.id)),
		`rounds Dami paid (${paidByDami.map((x) => x + 1).join(", ")}) count for Ada's slot`,
	);
	ok(
		(await activity.listActivity({ type: "slot_purchase" })).results.some((a) => a.group?.id === community && a.amount === "20.00"),
		"the purchase shows in Activity",
	);
	// Someone else in Community Circle lists their slot: Ada already holds one there.
	const { updateDb } = await import("@/mocks/db");
	const { createListing } = await import("@/mocks/slots");
	const { nowMs } = await import("@/mocks/clock");
	const second = updateDb((db) => {
		const g = db.groups.find((x) => x.id === community)!;
		return createListing(db, g, g.cycle!.schedule.at(-1)!, "10", new Date(nowMs()).toISOString());
	});
	await expectError(slots.requestTakeover(second.id), 409, "one slot per person per group");

	// Ada lists her own slot in Summer Fund, a simulated buyer asks, she puts them to a vote, then withdraws.
	const sellable = await slots.getSellerEligibility(summer.id);
	ok(sellable.eligible && sellable.position === 5 && sellable.checks.every((c) => c.ok), "Ada can list her slot 6");
	await expectError(slots.createListing(summer.id, { askingPrice: "-1" }), 400, "the asking price is a decimal string");
	const own = await slots.createListing(summer.id, { askingPrice: "15" });
	ok(own.mine && own.status === "open" && own.position === 5 && own.buyerEligibility === null, "Ada lists slot 6 for 15 USDC");
	await expectError(slots.requestTakeover(own.id), 400, "you can't request your own slot");
	await expectError(slots.createListing(summer.id, { askingPrice: "15" }), 409, "one listing per slot");
	ok((await slots.getSellerEligibility(summer.id)).checks.find((c) => c.key === "notListed")?.ok === false, "the checklist now says it's listed");
	setClockOffset(clockOffset() + 60_000);
	const withRequest = await slots.getListing(own.id);
	ok((withRequest.requests?.length ?? 0) > 0, `a simulated buyer asks for it (${withRequest.requests?.[0]?.buyer.firstName})`);
	const picked = await slots.selectBuyer(own.id, withRequest.requests![0]!.buyer.userId);
	ok(picked.transfer?.proposalStatus === "active" && picked.transfer.buyer.userId === withRequest.requests![0]!.buyer.userId, "Ada puts them to the group's vote");
	await slots.withdrawListing(summer.id);
	ok((await slots.getListing(own.id)).status === "withdrawn", "Ada withdraws the listing; the slot stays hers");
	await expectError(slots.withdrawListing(summer.id), 404, "nothing left to withdraw");

	// ---- a missed contribution of Ada's own, then she settles it
	setClockOffset(clockOffset() + 30 * 86_400_000);
	const lagosNow = await circle.getCycle(lagos.id);
	const mine = lagosNow.openDefaults.find((x) => x.member.userId === me.id);
	if (mine) {
		const h = await mockWallet.pay({ destination: lagosNow.escrowAccount!, amount: mine.amount, assetCode: "USDC", assetIssuer: null, memo: "m" }, me.wallet!.publicKey);
		const left = await circle.settleDefault(lagos.id, mine.id, h);
		ok(!left.some((x) => x.id === mine.id), "Ada settles her own missed contribution");
	} else ok(false, "expected Ada to default after skipping 30 days");

	// ---- personal savings (v3: prepare → the wallet signs → confirm; the clock is 30 days on from here)
	const savings = await import("@/features/savings/api");
	const plans = await savings.listSavingsPlans();
	const travel = plans.find((p) => p.name === "Travel fund")!;
	const laptop = plans.find((p) => p.name === "Laptop fund")!;
	ok(
		travel?.lock === "flexible" && travel.balance === "1200.00" && travel.progressPercent === 40 && travel.canWithdraw && travel.movements === null,
		"Travel fund: flexible, 1,200 of 3,000 (40%), withdrawable; the list has no movements",
	);
	ok(laptop?.lock === "until_date" && !laptop.canWithdraw && !!laptop.unlockAt, "Laptop fund: locked until a date");
	const dash = await savings.getSavingsOverview();
	ok(
		dash.personal.balance === "2000.00" && dash.personal.plans === 2 && Math.abs(Number(dash.totalSaved) - Number(dash.groups.totalSaved) - 2000) < 1e-6,
		`savings dashboard: ${dash.personal.balance} personal + ${dash.groups.totalSaved} in groups = ${dash.totalSaved}`,
	);

	const sign = (xdr: string) => mockWallet.signTransaction(xdr, owner);
	await expectError(savings.createSavingsPlan({ name: "Rent", lock: "until_date", target: "500" }), 400, "a date lock needs unlockAt");
	await expectError(
		savings.createSavingsPlan({ name: "Rent", lock: "flexible", target: "500", unlockAt: "2031-01-01T00:00:00Z" }),
		400,
		"a flexible goal takes no date",
	);
	await expectError(savings.createSavingsPlan({ name: "R", lock: "flexible", target: "500" }), 400, "a goal name needs 2 characters");
	await expectError(
		savings.createSavingsPlan({ name: "Rent", lock: "until_date", target: "500", unlockAt: "2031-01-01T00:00:00" }),
		400,
		"unlockAt needs a timezone",
	);
	const prepared = await savings.createSavingsPlan({ name: "Rent", lock: "until_target", target: "20.00" });
	ok(!!prepared.xdr && prepared.plan === null, "creating a goal returns a transaction to sign");
	await expectError(
		savings.confirmSavingsPlan(prepared.planId, { signedXdr: await mockWallet.signTransaction(prepared.xdr!, "GSOMEONEELSE") }),
		400,
		"a goal signed by another wallet is refused",
	);
	const rent = await savings.confirmSavingsPlan(prepared.planId, { signedXdr: await sign(prepared.xdr!) });
	ok(rent.ownerAddress === owner && rent.balance === "0.00" && !rent.canWithdraw && !!rent.txUrl, "confirmed: the linked wallet owns the goal");
	ok((await savings.confirmSavingsPlan(prepared.planId, { signedXdr: await sign(prepared.xdr!) })).id === rent.id, "confirming twice returns the same goal");

	const before = Number((await mockWallet.usdcBalance(owner)).savings.usdc);
	await expectError(savings.prepareDeposit(rent.id, { amount: "1000000" }), 400, "can't deposit more than the wallet holds");
	const signedDeposit = await sign((await savings.prepareDeposit(rent.id, { amount: "15.00" })).xdr);
	await expectError(savings.confirmDeposit(rent.id, {}), 400, "a deposit needs the signed transaction");
	await savings.confirmDeposit(rent.id, { signedXdr: signedDeposit });
	const repeated = await savings.confirmDeposit(rent.id, { signedXdr: signedDeposit });
	ok(repeated.balance === "15.00" && !repeated.canWithdraw, "a repeated confirm records the deposit once; below the target it stays locked");
	await expectError(savings.prepareWithdrawal(rent.id, { amount: "1.00" }), 409, "a target lock refuses withdrawals below the target");
	await savings.confirmDeposit(rent.id, { signedXdr: await sign((await savings.prepareDeposit(rent.id, { amount: "5.00" })).xdr) });
	const reached = await savings.getSavingsPlan(rent.id);
	ok(
		reached.balance === "20.00" && reached.progressPercent === 100 && reached.canWithdraw && reached.movements?.length === 2 && reached.movements[0]!.balanceAfter === "20.00",
		"target reached: unlocked; movements newest first, with the balance after each",
	);
	await expectError(savings.prepareWithdrawal(rent.id, { amount: "21.00" }), 409, "can't withdraw more than the balance");
	await savings.confirmWithdrawal(rent.id, { signedXdr: await sign((await savings.prepareWithdrawal(rent.id, { amount: "4.00" })).xdr) });
	const after = Number((await mockWallet.usdcBalance(owner)).savings.usdc);
	const relocked = await savings.getSavingsPlan(rent.id);
	ok(
		relocked.balance === "16.00" && !relocked.canWithdraw && Math.abs(after - (before - 20 + 4)) < 1e-6,
		"the withdrawal goes back to the owner wallet, and below the target the goal locks again",
	);

	await expectError(savings.prepareWithdrawal(laptop.id, { amount: "1.00" }), 409, "a date lock refuses withdrawals before its date");
	setClockOffset(clockOffset() + 6 * 86_400_000);
	const released = await savings.getSavingsPlan(laptop.id);
	ok(released.canWithdraw && released.balance === "800.00", "after the release date the date-locked goal can be withdrawn");
	await savings.confirmWithdrawal(laptop.id, { signedXdr: await sign((await savings.prepareWithdrawal(laptop.id, { amount: "800.00" })).xdr) });
	const emptied = await savings.getSavingsPlan(laptop.id);
	ok(emptied.balance === "0.00" && !emptied.canWithdraw, "the released goal is withdrawn in full; nothing left to withdraw");

	const savingsDeposits = await activity.listActivity({ type: "savings_deposit" });
	ok(
		savingsDeposits.results.some((a) => a.plan?.id === rent.id && a.group === null) &&
			savingsDeposits.results.every((a) => a.kind === "savings_deposit"),
		"savings deposits show in Activity, linked to their goal",
	);
	const statement = await activity.getStatement({});
	ok(
		Number(statement.totals.savingsDeposits) >= 20 && Number(statement.totals.savingsWithdrawals) === 804,
		`statement totals: ${statement.totals.savingsDeposits} deposited, ${statement.totals.savingsWithdrawals} withdrawn`,
	);

	// ---- test USDC faucet (testnet; the simulated wallet already trusts USDC)
	await expectError(wallet.prepareFaucetTrustline(), 409, "the faucet's trustline step: already trusts USDC");
	const usdcBefore = Number((await mockWallet.usdcBalance(owner)).savings.usdc);
	const sent = await wallet.requestTestUsdc();
	ok(sent.amount === "1000" && Number((await mockWallet.usdcBalance(owner)).savings.usdc) === usdcBefore + 1000, "the faucet sends 1,000 test USDC");
	await expectError(wallet.requestTestUsdc(), 429, "the faucet gives once per wallet per hour");

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
