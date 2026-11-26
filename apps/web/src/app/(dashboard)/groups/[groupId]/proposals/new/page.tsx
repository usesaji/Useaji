"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HiCalendarDays, HiPause, HiPlay } from "react-icons/hi2";
import { Avatar } from "@repo/ui/avatar";
import { PageHeader } from "@/components/PageHeader";
import { useCycle } from "@/features/circle/hooks";
import { ACTIONS, thresholdLabel } from "@/features/governance/copy";
import { Note, OptionCard, PageState, PrimaryAction } from "@/features/governance/components/ui";
import { useCreateProposal, useGovernance } from "@/features/governance/hooks";
import { useMemberNames } from "@/features/groups/use-names";
import type { ProposalType } from "@/lib/api/dto";
import { pageRoutes } from "@/lib/routes";

/** Recovery starts from the recovery screen; slot transfers from the slot marketplace (the API refuses them here). */
type Action = Exclude<ProposalType, "recovery" | "slot_transfer">;

const ICONS: Record<Action, React.ComponentType<{ className?: string }>> = {
	pause: HiPause,
	resume: HiPlay,
	update_schedule: HiCalendarDays,
};

/** Create Proposal (p3): pick a supported action, explain it, send it to a vote. Recovery proposals start from the recovery screen. */
export default function NewProposalPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const router = useRouter();
	const cycle = useCycle(groupId);
	const rules = useGovernance(groupId);
	const { name } = useMemberNames(groupId);
	const create = useCreateProposal(groupId);

	const [action, setAction] = useState<Action | null>(null);
	const [description, setDescription] = useState("");
	const [order, setOrder] = useState<string[] | null>(null);

	const c = cycle.data;
	const round = c?.round ?? 0;
	// Future rounds nobody has been paid for yet: the only part of the schedule a vote may change.
	const future = (c?.schedule ?? []).filter((s) => s.round > round && !s.paidOut);
	const fromRound = future[0]?.round;
	const recipients = order ?? future.map((s) => s.member.userId);
	const byId = new Map(future.map((s) => [s.member.userId, s.member]));
	const changed = recipients.some((id, i) => id !== future[i]?.member.userId);

	const blocked = (a: Action): string | null => {
		if (!c) return null;
		if (c.status !== "active") return "The group isn't running.";
		if (a === "pause" && c.paused) return "The group is already paused.";
		if (a === "resume" && !c.paused) return "The group isn't paused.";
		if (a === "update_schedule" && future.length < 2) return "There aren't two upcoming rounds left to reorder.";
		return null;
	};

	const move = (index: number, by: number) => {
		const to = index + by;
		if (to < 0 || to >= recipients.length) return;
		const next = [...recipients];
		[next[index], next[to]] = [next[to]!, next[index]!];
		setOrder(next);
	};

	const valid = !!action && description.trim().length >= 3 && (action !== "update_schedule" || changed);
	const submit = () => {
		if (!action) return;
		create.mutate(
			action === "update_schedule" ? { type: action, description: description.trim(), fromRound, recipients } : { type: action, description: description.trim() },
			{ onSuccess: (p) => router.push(pageRoutes.dashboardRoutes.PROPOSAL(groupId, p.id)) },
		);
	};

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader title="Create Proposal" back backHref={pageRoutes.dashboardRoutes.PROPOSALS(groupId)} />
			<PageState loading={cycle.isLoading} error={cycle.error} onRetry={() => void cycle.refetch()} />

			{c && (
				<>
					{c.inRecovery && (
						<Note tone="yellow" title="A missed contribution is waiting on the group">
							Recovery decisions are made from the recovery screen.{" "}
							<a href={pageRoutes.dashboardRoutes.RECOVERY(groupId)} className="underline">
								Open recovery
							</a>
						</Note>
					)}
					<div className="grid items-start gap-6 md:grid-cols-2">
						<section>
							<p className="text-base md:text-lg">What should the group decide?</p>
							<div className="mt-3 space-y-3" role="radiogroup" aria-label="Proposal type">
								{(Object.keys(ICONS) as Action[]).map((a) => {
									const reason = blocked(a);
									return (
										<OptionCard
											key={a}
											selected={action === a}
											onSelect={() => setAction(a)}
											disabled={reason !== null}
											Icon={ICONS[a]}
											title={ACTIONS[a].label}
											subtitle={reason ?? ACTIONS[a].subtitle}
										/>
									);
								})}
							</div>
						</section>

						<section className="space-y-5">
							<label className="block space-y-2">
								<span className="text-xs font-light md:text-sm">Why should the group do this?</span>
								<textarea
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder={action ? ACTIONS[action].placeholder : "Give members a clear reason"}
									rows={4}
									maxLength={1000}
									className="w-full resize-none rounded-[20px] border border-neutral-light-hover bg-white px-5 py-3 text-sm outline-none focus:border-primary"
								/>
							</label>

							{action === "update_schedule" && fromRound !== undefined && (
								<div className="space-y-2">
									<p className="text-xs font-light md:text-sm">New order from round {fromRound + 1}</p>
									<ol className="space-y-2">
										{recipients.map((id, i) => {
											const m = byId.get(id)!;
											return (
												<li key={id} className="flex items-center justify-between gap-3 rounded-xl bg-panel px-3 py-2">
													<span className="flex min-w-0 items-center gap-2">
														<span className="w-14 shrink-0 text-xs text-ink-muted">Round {fromRound + i + 1}</span>
														<Avatar src={m.avatarUrl} initials={m.initials} className="size-8" />
														<span className="truncate text-sm">{name(m)}</span>
													</span>
													<span className="flex shrink-0 gap-1">
														<button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Earlier" className="rounded-full px-2 disabled:opacity-30">
															↑
														</button>
														<button type="button" onClick={() => move(i, 1)} disabled={i === recipients.length - 1} aria-label="Later" className="rounded-full px-2 disabled:opacity-30">
															↓
														</button>
													</span>
												</li>
											);
										})}
									</ol>
									{!changed && <p className="text-[11px] font-light text-ink-muted">Move someone to propose a new order.</p>}
								</div>
							)}

							{action && <Note title="If approved">{ACTIONS[action].effect}</Note>}

							<div className="md:flex md:justify-end">
								<PrimaryAction onClick={submit} disabled={!valid || create.isPending}>
									{create.isPending ? "Creating…" : "Send to a Vote"}
								</PrimaryAction>
							</div>
						</section>
					</div>

					{rules.data && (
						<section className="rounded-[14px] bg-primary-light px-5 py-5">
							<p className="text-base text-primary md:text-lg">Approval threshold</p>
							<p className="mt-1 max-w-md text-xs md:text-sm">
								The action happens only when {thresholdLabel({ kind: rules.data.thresholdKind, value: rules.data.thresholdValue })} vote For within{" "}
								{Math.round(rules.data.votingPeriodHours / 24)} days. Reaching it carries the decision out on Stellar right away.
							</p>
						</section>
					)}
				</>
			)}
		</div>
	);
}
