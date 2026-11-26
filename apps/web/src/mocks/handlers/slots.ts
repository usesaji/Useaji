import { ms } from "@/mocks/clock";
import { groupById, membership } from "@/mocks/engine";
import { badRequest, notFound, paginate, route, validate, type Ctx } from "@/mocks/router";
import {
	acceptListing,
	canSeeListing,
	createListing,
	listingDto,
	prepareAccept,
	requestTakeover,
	selectBuyer,
	sellerEligibility,
	transferDto,
	withdrawListing,
	withdrawRequest,
} from "@/mocks/slots";
import type { MockDb, MockSlotListing } from "@/mocks/types";

/**
 * The slot marketplace (v3), as the API serves it (docs/frontend-integration.md §6): listings with
 * an asking price, takeover requests, the seller's pick (a `slot_transfer` proposal, voted on with
 * the proposal routes), the buyer's accept (prepare → sign → accept), and transfer history.
 * Rules: mocks/slots.ts.
 */

const newestFirst = (a: MockSlotListing, b: MockSlotListing) => ms(b.createdAt) - ms(a.createdAt);

function listing(db: MockDb, ctx: Pick<Ctx, "user" | "params">) {
	const row = db.slotListings.find((l) => l.id === ctx.params.id);
	if (!row || !canSeeListing(db, row, ctx.user.id)) throw notFound("Listing not found");
	return row;
}

function myGroup(db: MockDb, ctx: Pick<Ctx, "user" | "params">) {
	const group = groupById(db, ctx.params.id);
	if (!group || !membership(db, group.id, ctx.user.id)) throw notFound("Group not found.");
	return group;
}

const AMOUNT = /^\d+(\.\d{1,7})?$/;

/** Open listings in active public groups, newest first; `search` (group name), `minPrice`/`maxPrice` (inclusive). */
route("GET", "/slots/marketplace", { message: "Marketplace retrieved" }, ({ db, at, user, query }) => {
	const search = (query.search ?? "").trim().toLowerCase();
	const min = query.minPrice;
	const max = query.maxPrice;
	validate([
		[search.length <= 60, "search must be shorter than or equal to 60 characters"],
		[min === undefined || AMOUNT.test(min), "minPrice must be a decimal string"],
		[max === undefined || AMOUNT.test(max), "maxPrice must be a decimal string"],
	]);
	if (min !== undefined && max !== undefined && Number(min) > Number(max)) throw badRequest("minPrice can't be above maxPrice");
	const rows = db.slotListings
		.filter((l) => {
			const group = groupById(db, l.groupId)!;
			if (l.status !== "open" || group.status !== "active" || !group.publicDiscovery) return false;
			if (search && !group.name.toLowerCase().includes(search)) return false;
			const price = Number(l.askingPrice);
			return (min === undefined || price >= Number(min)) && (max === undefined || price <= Number(max));
		})
		.sort(newestFirst);
	return paginate(
		rows.map((l) => listingDto(db, l, user.id, at)),
		query,
	);
});

/** Before `/slots/listings/:id` (the router takes the first match). */
route("GET", "/slots/listings/mine", { message: "Your listings retrieved" }, ({ db, at, user }) => ({
	selling: db.slotListings
		.filter((l) => l.sellerId === user.id)
		.sort(newestFirst)
		.slice(0, 100)
		.map((l) => listingDto(db, l, user.id, at)),
	buying: db.slotListings
		.filter((l) => l.everRequested.includes(user.id) || l.transfer?.buyerId === user.id || l.soldTo === user.id)
		.sort(newestFirst)
		.slice(0, 100)
		.map((l) => listingDto(db, l, user.id, at)),
}));

route("GET", "/slots/listings/:id", { message: "Listing retrieved" }, (ctx) => listingDto(ctx.db, listing(ctx.db, ctx), ctx.user.id, ctx.at));

route("GET", "/groups/:id/slots/eligibility", { message: "Eligibility retrieved" }, (ctx) =>
	sellerEligibility(ctx.db, myGroup(ctx.db, ctx), ctx.user.id, ctx.at),
);

route("POST", "/groups/:id/slots/listings", { status: 201, message: "Slot listed" }, (ctx) => {
	const l = createListing(ctx.db, myGroup(ctx.db, ctx), ctx.user.id, ctx.body.askingPrice, ctx.now);
	return listingDto(ctx.db, l, ctx.user.id, ctx.at);
});

route("DELETE", "/groups/:id/slots/listings/mine", { message: "Listing withdrawn" }, (ctx) => {
	withdrawListing(ctx.db, myGroup(ctx.db, ctx), ctx.user.id, ctx.now);
	return null;
});

route("POST", "/slots/listings/:id/takeover-requests", { message: "Takeover requested" }, (ctx) => {
	const l = listing(ctx.db, ctx);
	requestTakeover(ctx.db, l, ctx.user.id, ctx.now);
	return listingDto(ctx.db, l, ctx.user.id, ctx.at);
});

route("DELETE", "/slots/listings/:id/takeover-requests", { message: "Takeover request withdrawn" }, (ctx) => {
	withdrawRequest(ctx.db, listing(ctx.db, ctx), ctx.user.id);
	return null;
});

route("POST", "/slots/listings/:id/takeover-requests/:buyerId/select", { message: "Transfer proposed" }, (ctx) => {
	const l = listing(ctx.db, ctx);
	selectBuyer(ctx.db, l, ctx.user.id, ctx.params.buyerId!, ctx.now);
	return listingDto(ctx.db, l, ctx.user.id, ctx.at);
});

route("POST", "/slots/listings/:id/accept/prepare", { message: "Transaction prepared" }, (ctx) => ({
	xdr: prepareAccept(ctx.db, listing(ctx.db, ctx), ctx.user.id, ctx.at),
}));

route("POST", "/slots/listings/:id/accept", { message: "Slot transferred" }, (ctx) => {
	const l = listing(ctx.db, ctx);
	const signed = String(ctx.body.signedXdr ?? "");
	if (!signed) {
		if (ctx.body.txHash) throw badRequest("The mock can't look transactions up by hash: send signedXdr.");
		throw badRequest("signedXdr or txHash is required");
	}
	acceptListing(ctx.db, l, ctx.user.id, signed, ctx.now);
	return listingDto(ctx.db, l, ctx.user.id, ctx.at);
});

/** Members only, newest first. */
route("GET", "/groups/:id/slots/transfers", { message: "Slot transfers retrieved" }, (ctx) => {
	const group = myGroup(ctx.db, ctx);
	return ctx.db.slotTransfers
		.filter((t) => t.groupId === group.id)
		.sort((a, b) => ms(b.at) - ms(a.at))
		.map((t) => transferDto(ctx.db, t));
});
