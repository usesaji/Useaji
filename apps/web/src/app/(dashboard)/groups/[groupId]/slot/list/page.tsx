"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@repo/ui/button";
import { InputField } from "@repo/ui/input-field";
import { QueryState } from "@repo/ui/query-state";
import { Card, TwoColumns } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { useCycle } from "@/features/circle/hooks";
import { useGroup } from "@/features/groups/hooks";
import { contributions, priceLabel, slotLabel } from "@/features/slots/copy";
import { ChecksCard } from "@/features/slots/components/SlotUi";
import { useCreateListing, useSellerEligibility } from "@/features/slots/hooks";
import { formatMoney, frequencyLabel } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/** A decimal string, at most 7 decimals; "0" gives the slot away. */
const PRICE = /^\d+(\.\d{1,7})?$/;

/**
 * List a savings slot (v3 screen 04): the API's checklist (`GET /groups/{id}/slots/eligibility`;
 * submit stays off until every rule holds), an asking price (the design had none; the API requires
 * one, "0" gives it away), and what a buyer would take over.
 */
export default function ListSlotPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const router = useRouter();
	const r = pageRoutes.dashboardRoutes;
	const eligibility = useSellerEligibility(groupId);
	const group = useGroup(groupId);
	const cycle = useCycle(groupId);
	const create = useCreateListing(groupId);
	const [price, setPrice] = useState("");
	const [touched, setTouched] = useState(false);
	const e = eligibility.data;
	const g = group.data;
	const c = cycle.data;
	const value = price.trim();
	const error = !value ? "Enter an asking price (0 gives the slot away)" : !PRICE.test(value) ? "Enter an amount like 50 or 12.5" : null;

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		setTouched(true);
		if (error || !e?.eligible) return;
		create.mutate(value, { onSuccess: (listing) => router.push(r.SLOT_LISTING(listing.id)) });
	};

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader
				title="List your slot"
				subtitle="Offer your payout position to someone outside the group. The group votes on the buyer you choose."
				back
				backHref={r.CIRCLE(groupId)}
			/>
			<QueryState isLoading={eligibility.isLoading} error={eligibility.error} onRetry={() => void eligibility.refetch()} />
			{e && (
				<form noValidate onSubmit={submit}>
					<TwoColumns
						main={
							<>
								<section className="space-y-4 rounded-[20px] bg-panel p-5">
									<div>
										<h3 className="text-base md:text-lg">
											{g?.name ?? "Your group"}
											{e.position !== null ? ` · ${slotLabel(e.position, c?.schedule.length)}` : ""}
										</h3>
										{g && (
											<p className="mt-2 text-xs font-light text-ink-muted md:text-sm">
												{formatMoney(g.contributionAmount, g.asset)} {frequencyLabel(g.frequency, g.customIntervalDays).toLowerCase()}
												{c && e.position !== null ? ` · payout in round ${e.position + 1} · ${contributions(Math.max(0, c.schedule.length - (c.round ?? 0)))} left` : ""}
											</p>
										)}
									</div>
									<InputField
										name="askingPrice"
										label={`Asking price · ${g?.asset ?? "USDC"}`}
										inputMode="decimal"
										placeholder="0.00"
										value={price}
										onChange={(event) => setPrice(event.target.value)}
										onBlur={() => setTouched(true)}
										disabled={create.isPending || !e.eligible}
										error={touched ? error : null}
										description="What the buyer pays you when they accept. 0 gives the slot away."
									/>
								</section>
								<ChecksCard title="Before you list" checks={e.checks} />
							</>
						}
						side={
							<>
								<Card title="Listing summary">
									<p>Slot · {e.position !== null ? slotLabel(e.position, c?.schedule.length) : "—"}</p>
									<p>Asking price · {!error ? priceLabel(value, g?.asset) : "—"}</p>
									<p>Paid to · your linked wallet, when the buyer accepts</p>
								</Card>
								<Card tone="lilac" title="What happens next">
									<p>Buyers from outside the group ask for your slot. You pick one and the other members vote.</p>
									<p>
										Once they approve, the buyer accepts: they pay the asking price and join at your position, and you leave the
										group. Your past contributions stay on record under your name.
									</p>
									<p>You can withdraw the listing until then.</p>
								</Card>
								<div className="grid grid-cols-2 gap-3">
									<Button
										type="submit"
										isLoading={create.isPending}
										disabled={!e.eligible || create.isPending}
										className="w-full text-sm lg:text-base"
									>
										List slot
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
