/**
 * The slot marketplace (`/v1/slots/*`, `/v1/groups/{id}/slots/*`, v3; docs/frontend-integration.md §6).
 * Seller: list (with an asking price), see requests, put one buyer to the group's vote (a
 * `slot_transfer` proposal, voted on with the governance routes), withdraw. Buyer: browse, request,
 * then accept once approved: prepare → the wallet signs (co-signed by Saji for ~2 minutes) → accept.
 */
import { apiDelete, apiGet, apiPost, type Page } from "@/lib/api/client";
import type {
	AcceptTransferDto,
	CreateListingDto,
	ListingDto,
	MyListingsDto,
	PreparedTransactionDto,
	SellerEligibilityDto,
	SlotTransferDto,
} from "@/lib/api/dto";

export interface MarketplaceQuery {
	page?: number;
	limit?: number;
	/** Part of the group name, ignoring case (at most 60 characters). */
	search?: string;
	/** Asking price bounds, inclusive, as decimal strings. */
	minPrice?: string;
	maxPrice?: string;
}

/** Open listings in active public groups, newest first; filtered on the server across all pages. */
export const listMarketplace = (query: MarketplaceQuery = {}) => apiGet<Page<ListingDto>>("/slots/marketplace", query);

/** Listings you sell and ones you asked for, were chosen for or bought: any status, newest first. */
export const getMyListings = () => apiGet<MyListingsDto>("/slots/listings/mine");

/** Anyone can see listings in public groups; `requests` only for the seller. */
export const getListing = (id: string) => apiGet<ListingDto>(`/slots/listings/${id}`);

/** Whether you can list your slot now, each rule with what the API would answer. Non-members: 404. */
export const getSellerEligibility = (groupId: string) => apiGet<SellerEligibilityDto>(`/groups/${groupId}/slots/eligibility`);

/** `"0"` gives the slot away. 409 with the rule that fails. */
export const createListing = (groupId: string, input: CreateListingDto) => apiPost<ListingDto>(`/groups/${groupId}/slots/listings`, input);

/** Withdraws your open listing in the group (404 if none). */
export const withdrawListing = (groupId: string) => apiDelete(`/groups/${groupId}/slots/listings/mine`);

/** Repeating it is a no-op. */
export const requestTakeover = (id: string) => apiPost<ListingDto>(`/slots/listings/${id}/takeover-requests`);

export const withdrawTakeoverRequest = (id: string) => apiDelete(`/slots/listings/${id}/takeover-requests`);

/** The seller puts one requester to the group's vote: opens the `slot_transfer` proposal. */
export const selectBuyer = (id: string, buyerId: string) => apiPost<ListingDto>(`/slots/listings/${id}/takeover-requests/${buyerId}/select`);

/** The approved buyer's transaction, already co-signed by Saji: sign it within ~2 minutes. */
export const prepareAccept = (id: string) => apiPost<PreparedTransactionDto>(`/slots/listings/${id}/accept/prepare`);

/** `{ signedXdr }` (or `{ txHash }` on a retry); `{}` in simulated mode. Returns the listing, `status: "sold"`. */
export const acceptListing = (id: string, input: AcceptTransferDto) => apiPost<ListingDto>(`/slots/listings/${id}/accept`, input);

/** Members only, newest first. */
export const listSlotTransfers = (groupId: string) => apiGet<SlotTransferDto[]>(`/groups/${groupId}/slots/transfers`);
