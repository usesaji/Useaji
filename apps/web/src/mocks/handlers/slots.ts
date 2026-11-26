import { ms } from "@/mocks/clock";
import { groupById, membership } from "@/mocks/engine";
import { notFound, paginate, route, validate, type Ctx } from "@/mocks/router";
import {
	canSeeTakeover,
	cancelListing,
	createListing,
	listingDto,
	mySlotDto,
	requestTakeover,
	signTakeover,
	takeoverDto,
	voteOnTakeover,
	withdrawTakeover,
} from "@/mocks/slots";
import type { MockDb } from "@/mocks/types";

/**
 * Slot marketplace & takeover (v3, provisional): listings, takeover requests, the group's approval
 * vote, the incoming member's signature, transfer history. Not in the API yet: every route is
 * `notInApi`; the shapes are the app's proposal (Slot*Dto in lib/api/dto.ts). Rules: mocks/slots.ts.
 */

const newestFirst = <T extends { createdAt?: string; requestedAt?: string }>(a: T, b: T) =>
	ms(b.createdAt ?? b.requestedAt!) - ms(a.createdAt ?? a.requestedAt!);

function listing(db: MockDb, id: string) {
	const row = db.slotListings.find((l) => l.id === id);
	if (!row) throw notFound("Listing not found");
	return row;
}

function takeover(db: MockDb, ctx: Pick<Ctx, "user" | "params">) {
	const row = db.slotTakeovers.find((t) => t.id === ctx.params.id);
	if (!row || !canSeeTakeover(db, row, ctx.user.id)) throw notFound("Takeover request not found");
	return row;
}

function myGroup(db: MockDb, ctx: Pick<Ctx, "user" | "params">) {
	const group = groupById(db, ctx.params.id);
	if (!group || !membership(db, group.id, ctx.user.id)) throw notFound("Group not found.");
	return group;
}

// ---------------------------------------------------------------- listings

/** The marketplace: open and pending listings from every group; `?mine=true`: the caller's own, any status. */
route(
	"GET",
	"/slots/listings",
	{ message: "Listings retrieved", notInApi: "v3 slot marketplace, not in the API yet (BACKEND-GAPS.md, Slot marketplace)" },
	({ db, at, user, query }) => {
		const mine = query.mine === "true";
		const rows = db.slotListings
			.filter((l) => (mine ? l.sellerId === user.id : l.status === "open" || l.status === "pending"))
			.sort(newestFirst);
		return paginate(
			rows.map((l) => listingDto(db, l, user.id, at)),
			query,
		);
	},
);

route(
	"GET",
	"/slots/listings/:id",
	{ message: "Listing retrieved", notInApi: "v3 slot marketplace, not in the API yet (BACKEND-GAPS.md, Slot marketplace)" },
	({ db, at, user, params }) => listingDto(db, listing(db, params.id!), user.id, at),
);

route(
	"DELETE",
	"/slots/listings/:id",
	{ message: "Listing cancelled", notInApi: "v3 slot marketplace, not in the API yet (BACKEND-GAPS.md, Slot marketplace)" },
	({ db, at, user, params }) => {
		const row = listing(db, params.id!);
		cancelListing(db, row, user.id);
		return listingDto(db, row, user.id, at);
	},
);

/** The caller's own slot in a running group (404 when they have none left to collect). */
route(
	"GET",
	"/groups/:id/slot",
	{ message: "Slot retrieved", notInApi: "v3 slot marketplace, not in the API yet (BACKEND-GAPS.md, Slot marketplace)" },
	(ctx) => {
		const slot = mySlotDto(ctx.db, myGroup(ctx.db, ctx), ctx.user.id, ctx.at);
		if (!slot) throw notFound("You have no slot to collect in this group.");
		return slot;
	},
);

route(
	"POST",
	"/groups/:id/slot/listings",
	{ message: "Slot listed", notInApi: "v3 slot marketplace, not in the API yet (BACKEND-GAPS.md, Slot marketplace)" },
	(ctx) => {
		const { db, at, now, user, body } = ctx;
		validate([
			[typeof body.expiresAt === "string" && !Number.isNaN(ms(body.expiresAt)), "expiresAt must be a valid ISO 8601 date string"],
			[body.reason === undefined || typeof body.reason === "string", "reason must be a string"],
		]);
		const row = createListing(db, myGroup(db, ctx), user.id, { expiresAt: body.expiresAt, reason: body.reason }, now);
		return listingDto(db, row, user.id, at);
	},
);

// ---------------------------------------------------------------- takeovers

route(
	"POST",
	"/slots/listings/:id/takeovers",
	{ message: "Takeover requested", notInApi: "v3 slot marketplace, not in the API yet (BACKEND-GAPS.md, Slot marketplace)" },
	({ db, at, now, user, params }) => takeoverDto(db, requestTakeover(db, listing(db, params.id!), user.id, now), user.id, at),
);

/** `?mine=true`: requests the caller made; otherwise every request the caller can see. */
route(
	"GET",
	"/slots/takeovers",
	{
		message: "Takeover requests retrieved",
		notInApi: "v3 slot marketplace, not in the API yet (BACKEND-GAPS.md, Slot marketplace)",
	},
	({ db, at, user, query }) => {
		const rows = db.slotTakeovers
			.filter((t) => (query.mine === "true" ? t.toId === user.id : canSeeTakeover(db, t, user.id)))
			.sort(newestFirst);
		return paginate(
			rows.map((t) => takeoverDto(db, t, user.id, at)),
			query,
		);
	},
);

route(
	"GET",
	"/slots/takeovers/:id",
	{
		message: "Takeover request retrieved",
		notInApi: "v3 slot marketplace, not in the API yet (BACKEND-GAPS.md, Slot marketplace)",
	},
	(ctx) => takeoverDto(ctx.db, takeover(ctx.db, ctx), ctx.user.id, ctx.at),
);

route(
	"POST",
	"/slots/takeovers/:id/votes",
	{ message: "Vote recorded", notInApi: "v3 slot marketplace, not in the API yet (BACKEND-GAPS.md, Slot marketplace)" },
	(ctx) => {
		validate([[ctx.body.choice === "yes" || ctx.body.choice === "no", "choice must be one of the following values: yes, no"]]);
		const row = takeover(ctx.db, ctx);
		voteOnTakeover(ctx.db, row, ctx.user.id, ctx.body.choice, ctx.now);
		return takeoverDto(ctx.db, row, ctx.user.id, ctx.at);
	},
);

/** The incoming member signs the Soroban transfer; ownership moves (the mock can't verify the signature). */
route(
	"POST",
	"/slots/takeovers/:id/sign",
	{ message: "Slot transferred", notInApi: "v3 slot marketplace, not in the API yet (BACKEND-GAPS.md, Slot marketplace)" },
	(ctx) => {
		validate([[String(ctx.body.signature ?? "").length >= 20, "signature from the incoming member's wallet is required"]]);
		const row = takeover(ctx.db, ctx);
		signTakeover(ctx.db, row, ctx.user.id, ctx.now);
		return takeoverDto(ctx.db, row, ctx.user.id, ctx.at);
	},
);

route(
	"DELETE",
	"/slots/takeovers/:id",
	{
		message: "Takeover request withdrawn",
		notInApi: "v3 slot marketplace, not in the API yet (BACKEND-GAPS.md, Slot marketplace)",
	},
	(ctx) => {
		const row = takeover(ctx.db, ctx);
		withdrawTakeover(ctx.db, row, ctx.user.id, ctx.now);
		return takeoverDto(ctx.db, row, ctx.user.id, ctx.at);
	},
);

/** Every takeover in a group, newest first: open requests and the permanent record of transfers. */
route(
	"GET",
	"/groups/:id/slot-transfers",
	{
		message: "Slot transfers retrieved",
		notInApi: "v3 slot marketplace, not in the API yet (BACKEND-GAPS.md, Slot marketplace)",
	},
	(ctx) => {
		const group = myGroup(ctx.db, ctx);
		const rows = ctx.db.slotTakeovers.filter((t) => t.groupId === group.id).sort(newestFirst);
		return paginate(
			rows.map((t) => takeoverDto(ctx.db, t, ctx.user.id, ctx.at)),
			ctx.query,
		);
	},
);
