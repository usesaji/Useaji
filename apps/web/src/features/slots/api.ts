/**
 * Slot marketplace & takeover (v3). PROVISIONAL: the API doesn't have these routes yet; the mock
 * serves them (src/mocks/handlers/slots.ts) with the shapes in lib/api/dto.ts.
 */
import { apiDelete, apiGet, apiPost, type Page } from "@/lib/api/client";
import type { CreateSlotListingDto, MySlotDto, SlotListingDto, SlotTakeoverDto } from "@/lib/api/dto";

/** The marketplace (open and pending listings); `mine`: the caller's own listings, any status. */
export const listSlotListings = (query: { mine?: boolean; page?: number; limit?: number } = {}) =>
	apiGet<Page<SlotListingDto>>("/slots/listings", query);

export const getSlotListing = (id: string) => apiGet<SlotListingDto>(`/slots/listings/${id}`);

/** The seller withdraws an open listing (not while a request is under review). */
export const cancelSlotListing = (id: string) => apiDelete<SlotListingDto>(`/slots/listings/${id}`);

/** The caller's own slot in a running group, and whether they may list it. 404: no slot left to collect. */
export const getMySlot = (groupId: string) => apiGet<MySlotDto>(`/groups/${groupId}/slot`);

export const createSlotListing = (groupId: string, input: CreateSlotListingDto) =>
	apiPost<SlotListingDto>(`/groups/${groupId}/slot/listings`, input);

/** Needs a linked wallet and no slot in the group yet. Opens the group's approval vote. */
export const requestTakeover = (listingId: string) => apiPost<SlotTakeoverDto>(`/slots/listings/${listingId}/takeovers`);

/** `mine`: requests the caller made. */
export const listTakeovers = (query: { mine?: boolean; page?: number; limit?: number } = {}) =>
	apiGet<Page<SlotTakeoverDto>>("/slots/takeovers", query);

export const getTakeover = (id: string) => apiGet<SlotTakeoverDto>(`/slots/takeovers/${id}`);

/** A reviewing member's vote. Final. */
export const voteOnTakeover = (id: string, choice: "yes" | "no") =>
	apiPost<SlotTakeoverDto>(`/slots/takeovers/${id}/votes`, { choice });

/** The incoming member's wallet signature on the Soroban transfer; ownership moves. */
export const signTakeover = (id: string, signature: string) =>
	apiPost<SlotTakeoverDto>(`/slots/takeovers/${id}/sign`, { signature });

export const withdrawTakeover = (id: string) => apiDelete<SlotTakeoverDto>(`/slots/takeovers/${id}`);

/** Every takeover in a group, newest first: open requests and completed transfers. */
export const listSlotTransfers = (groupId: string, query: { page?: number; limit?: number } = {}) =>
	apiGet<Page<SlotTakeoverDto>>(`/groups/${groupId}/slot-transfers`, query);
