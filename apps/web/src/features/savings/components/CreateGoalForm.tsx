"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@repo/ui/button";
import { Form, FormControl, FormField, FormItem } from "@repo/ui/form";
import { InputField } from "@repo/ui/input-field";
import { cn } from "@repo/ui/lib/utils";
import { LinkButton } from "@/components/LinkButton";
import { LOCK, LOCKS } from "@/features/savings/copy";
import { Card, TwoColumns } from "@/components/Cards";
import { useCreateSavingsPlan } from "@/features/savings/hooks";
import { formatMoney, longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { shortAddress, STELLAR_NETWORK_LABEL } from "@/lib/stellar/config";
import { currentTime, useNow } from "@/lib/use-now";

/** "2026-03-31" (the date input) → the end of that day, local time, as ISO. */
const endOfDay = (day: string) => new Date(`${day}T23:59:59`).toISOString();
/** A local YYYY-MM-DD for the date input's `min`. */
const dayString = (ms: number) => {
	const d = new Date(ms);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const TEN_YEARS = 10 * 365 * 86_400_000;

/** The API's rules (docs/frontend-integration.md §5): name 2–60, a positive target, a date only for the date locks. */
const GoalSchema = z
	.object({
		name: z.string().trim().min(2, "Use at least 2 characters").max(60, "Keep the name under 60 characters"),
		target: z
			.string()
			.trim()
			.regex(/^\d+(\.\d{1,7})?$/, "Enter an amount like 3000 or 3000.50")
			.refine((v) => Number(v) > 0, "The target must be more than 0"),
		lock: z.enum(["flexible", "until_date", "until_target", "until_date_or_target"]),
		unlockAt: z.string(),
	})
	.superRefine((v, ctx) => {
		if (!LOCK[v.lock].dated) return;
		if (!v.unlockAt) {
			ctx.addIssue({ code: "custom", path: ["unlockAt"], message: "Choose the date your savings unlock" });
			return;
		}
		const at = new Date(endOfDay(v.unlockAt)).getTime();
		if (at <= currentTime()) ctx.addIssue({ code: "custom", path: ["unlockAt"], message: "Choose a date in the future" });
		else if (at > currentTime() + TEN_YEARS) ctx.addIssue({ code: "custom", path: ["unlockAt"], message: "Choose a date within 10 years" });
	});

type GoalValues = z.infer<typeof GoalSchema>;

/**
 * Create a savings goal (v3 screen 08): details on the left; how it locks and the summary on the
 * right. The design had flexible and locked; the API has four locks, so the picker shows all four.
 * The linked wallet owns the goal and signs the transaction that creates it.
 */
export function CreateGoalForm({ ownerAddress }: { ownerAddress: string }) {
	const router = useRouter();
	const now = useNow(60_000);
	const create = useCreateSavingsPlan(ownerAddress);
	const form = useForm<GoalValues>({
		resolver: zodResolver(GoalSchema),
		mode: "onTouched",
		defaultValues: { name: "", target: "", lock: "flexible", unlockAt: "" },
	});
	const [name, target, lock, unlockAt] = useWatch({
		control: form.control,
		name: ["name", "target", "lock", "unlockAt"],
	});
	const dated = LOCK[lock].dated;

	const submit = form.handleSubmit((v) =>
		create.mutate(
			{
				name: v.name.trim(),
				target: v.target.trim(),
				lock: v.lock,
				// Only the date locks take a date (the API refuses one otherwise): ISO, with its `Z`.
				...(LOCK[v.lock].dated ? { unlockAt: endOfDay(v.unlockAt) } : {}),
			},
			{ onSuccess: (plan) => router.push(pageRoutes.dashboardRoutes.SAVINGS_PLAN(plan.id)) },
		),
	);

	const amount = Number(target);
	const targetText = target && amount > 0 ? formatMoney(amount, "USDC") : "your target";
	const dateText = unlockAt ? longDate(endOfDay(unlockAt)) : "your release date";
	const unlocks = {
		flexible: "Any time",
		until_date: `From ${dateText}`,
		until_target: `Once you reach ${targetText}`,
		until_date_or_target: `From ${dateText}, or once you reach ${targetText}`,
	}[lock];

	return (
		<Form {...form}>
			<form noValidate onSubmit={submit}>
				<TwoColumns
					main={
						<section className="space-y-4 rounded-[20px] bg-panel p-5">
							<div>
								<h3 className="text-base md:text-lg">Goal details</h3>
								<p className="mt-2 text-xs font-light text-ink-muted md:text-sm">
									Save independently with your non-custodial wallet.
								</p>
							</div>
							<FormField
								control={form.control}
								name="name"
								render={({ field, fieldState }) => (
									<FormItem>
										<FormControl>
											<InputField
												{...field}
												label="Goal name"
												placeholder="e.g. Travel fund"
												maxLength={60}
												error={fieldState.error?.message}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="target"
								render={({ field, fieldState }) => (
									<FormItem>
										<FormControl>
											<InputField
												{...field}
												label="Target amount · USDC"
												placeholder="3,000.00"
												inputMode="decimal"
												error={fieldState.error?.message}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
							{dated && (
								<FormField
									control={form.control}
									name="unlockAt"
									render={({ field, fieldState }) => (
										<FormItem>
											<FormControl>
												<InputField
													{...field}
													type="date"
													label="Release date"
													min={now ? dayString(now + 86_400_000) : undefined}
													error={fieldState.error?.message}
												/>
											</FormControl>
										</FormItem>
									)}
								/>
							)}
						</section>
					}
					side={
						<>
							<div className="space-y-3" role="radiogroup" aria-label="How the goal locks">
								{LOCKS.map((k) => {
									const selected = lock === k;
									return (
										<button
											key={k}
											type="button"
											role="radio"
											aria-checked={selected}
											onClick={() => form.setValue("lock", k, { shouldValidate: form.formState.isSubmitted })}
											className={cn(
												"block w-full rounded-[20px] p-5 text-left transition",
												selected ? "bg-primary-light ring-1 ring-primary-light-active" : "bg-panel hover:bg-neutral-comment",
											)}
										>
											<span className={cn("block text-base md:text-lg", selected && "text-primary-darker")}>
												{LOCK[k].label}
												{selected ? " · Selected" : ""}
											</span>
											<span
												className={cn(
													"mt-2 block text-xs font-light md:text-sm",
													selected ? "text-primary-dark" : "text-ink-muted",
												)}
											>
												{LOCK[k].choose}
											</span>
										</button>
									);
								})}
							</div>
							<Card title="Plan summary">
								<p>
									{name.trim() || "Your goal"} · {LOCK[lock].heading}
								</p>
								<p>Target · {target && amount > 0 ? targetText : "Your target"}</p>
								<p>Withdrawals · {unlocks}</p>
								<p>Owner wallet · {shortAddress(ownerAddress)}</p>
								<p>Asset · Test USDC on {STELLAR_NETWORK_LABEL}</p>
							</Card>
							<div className="grid grid-cols-2 gap-3">
								<Button
									type="submit"
									isLoading={create.isPending && create.phase !== "wallet"}
									disabled={create.isPending}
									className="w-full text-sm lg:text-base"
								>
									{create.phase === "wallet" ? "Check your wallet…" : "Create savings goal"}
								</Button>
								<LinkButton href={pageRoutes.dashboardRoutes.SAVINGS} variant="soft" className="w-full text-sm lg:text-base">
									Cancel
								</LinkButton>
							</div>
						</>
					}
				/>
			</form>
		</Form>
	);
}
