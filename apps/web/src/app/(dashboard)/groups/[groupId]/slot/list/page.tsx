"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@repo/ui/button";
import { InputField } from "@repo/ui/input-field";
import { QueryState } from "@repo/ui/query-state";
import { Card, TwoColumns } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { ChecksCard, TermsCard } from "@/features/slots/components/SlotUi";
import { useCreateSlotListing, useMySlot } from "@/features/slots/hooks";
import { useGroup } from "@/features/groups/hooks";
import { longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { currentTime, useNow } from "@/lib/use-now";

const DAY = 86_400_000;
/** A local YYYY-MM-DD for the date input. */
const dayString = (ms: number) => {
	const d = new Date(ms);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * List a savings slot (v3 screen 04): the current owner offers their position. Listing details on
 * the left with the eligibility check; what the new owner takes over and the acknowledgement on the
 * right. The API re-checks everything (and that the listing ends before the payout round opens).
 */
export default function ListSlotPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const router = useRouter();
	const r = pageRoutes.dashboardRoutes;
	const group = useGroup(groupId);
	const slot = useMySlot(groupId);
	const create = useCreateSlotListing(groupId);
	const now = useNow(60_000);
	const [expires, setExpires] = useState("");
	const [reason, setReason] = useState("");
	const [understood, setUnderstood] = useState(false);
	const [touched, setTouched] = useState(false);

	const s = slot.data;
	const g = group.data;
	const expiresMs = expires ? new Date(`${expires}T23:59:59`).getTime() : NaN;
	const dateError = !expires
		? "Choose when the listing ends"
		: expiresMs <= currentTime()
			? "Choose a date in the future"
			: expiresMs > currentTime() + 30 * DAY
				? "A listing can run for at most 30 days"
				: null;

	const publish = (event: React.FormEvent) => {
		event.preventDefault();
		setTouched(true);
		if (dateError || !understood || !s?.canList) return;
		create.mutate(
			{ expiresAt: new Date(expiresMs).toISOString(), ...(reason.trim() ? { reason: reason.trim() } : {}) },
			{ onSuccess: (listing) => router.push(r.SLOT_LISTING(listing.id)) },
		);
	};

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader
				title="List a savings slot"
				subtitle="Offer your position to an eligible member."
				back
				backHref={r.CIRCLE(groupId)}
			/>
			<QueryState
				isLoading={slot.isLoading || group.isLoading}
				error={slot.error ?? group.error}
				onRetry={() => void slot.refetch()}
			/>
			{slot.data === null && (
				<Card>
					<p>You have no slot left to list in this group: your payout has already been made.</p>
				</Card>
			)}
			{s?.listing && (
				<Card tone="lilac" title="Your slot is already listed">
					<p>It&apos;s in the marketplace until {longDate(s.listing.expiresAt)}.</p>
					<LinkButton href={r.SLOT_LISTING(s.listing.id)} className="mt-2 text-sm lg:text-base">
						View your listing
					</LinkButton>
				</Card>
			)}
			{s && g && !s.listing && (
				<form noValidate onSubmit={publish}>
					<TwoColumns
						main={
							<>
								<section className="space-y-4 rounded-[20px] bg-panel p-5">
									<div>
										<h3 className="text-base md:text-lg">Listing details</h3>
										<p className="mt-2 text-xs font-light text-ink-muted md:text-sm">{g.name} · Your current position</p>
									</div>
									<InputField name="slot" label="Savings slot" value={`Slot #${s.slotNumber} of ${s.totalRounds}`} readOnly />
									<InputField
										name="expires"
										type="date"
										label="Listing expires"
										value={expires}
										min={now ? dayString(now + DAY) : undefined}
										max={now ? dayString(now + 30 * DAY) : undefined}
										onChange={(e) => setExpires(e.target.value)}
										onBlur={() => setTouched(true)}
										error={touched ? dateError : null}
									/>
									<InputField
										name="reason"
										label="Reason for transfer (optional)"
										placeholder="e.g. I need a more flexible savings schedule."
										value={reason}
										maxLength={280}
										onChange={(e) => setReason(e.target.value)}
									/>
								</section>
								<ChecksCard title={s.canList ? "Eligibility checked" : "You can't list this slot yet"} checks={s.checks} />
							</>
						}
						side={
							<>
								<TermsCard
									title="What the new owner takes over"
									terms={s.terms}
									slotNumber={s.slotNumber}
									totalRounds={s.totalRounds}
									asset={g.asset}
								/>
								<Card tone="lilac" title="Before you publish">
									<p>
										You remain responsible for contributions until a Soroban transfer is confirmed. Group approval is required.
									</p>
								</Card>
								<label className="flex items-center gap-3 text-xs md:text-sm">
									<input
										type="checkbox"
										checked={understood}
										onChange={(e) => setUnderstood(e.target.checked)}
										className="size-4 accent-primary"
									/>
									I understand my obligations until transfer
								</label>
								<div className="grid grid-cols-2 gap-3">
									<Button
										type="submit"
										className="w-full text-sm lg:text-base"
										disabled={!understood || !s.canList}
										isLoading={create.isPending}
									>
										Publish listing
									</Button>
									<LinkButton href={r.CIRCLE(groupId)} variant="soft" className="w-full text-sm lg:text-base">
										Cancel
									</LinkButton>
								</div>
							</>
						}
					/>
				</form>
			)}
		</div>
	);
}
