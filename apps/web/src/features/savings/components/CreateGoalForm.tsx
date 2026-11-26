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
import { KIND } from "@/features/savings/copy";
import { Card, TwoColumns } from "@/components/Cards";
import { useCreateSavingsPlan } from "@/features/savings/hooks";
import type { SavingsPlanKind } from "@/lib/api/dto";
import { formatMoney, longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { STELLAR_NETWORK_LABEL } from "@/lib/stellar/config";
import { currentTime, useNow } from "@/lib/use-now";

/** "2026-03-31" (the date input) → the end of that day, local time, as ISO. */
const endOfDay = (day: string) => new Date(`${day}T23:59:59`).toISOString();
/** A local YYYY-MM-DD for the date input's `min`. */
const dayString = (ms: number) => {
	const d = new Date(ms);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const GoalSchema = z
	.object({
		name: z.string().trim().min(1, "Name your goal").max(60, "Keep the name under 60 characters"),
		targetAmount: z
			.string()
			.trim()
			.regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 3000 or 3000.50")
			.refine((v) => Number(v) > 0, "The target must be more than 0")
			.refine((v) => Number(v) <= 1_000_000, "The target can be at most 1,000,000 USDC"),
		kind: z.enum(["flexible", "locked"]),
		targetDate: z.string(),
	})
	.superRefine((v, ctx) => {
		if (v.kind === "locked" && !v.targetDate)
			ctx.addIssue({ code: "custom", path: ["targetDate"], message: "Choose the date your savings unlock" });
		if (v.targetDate && new Date(endOfDay(v.targetDate)).getTime() <= currentTime())
			ctx.addIssue({ code: "custom", path: ["targetDate"], message: "Choose a date in the future" });
	});

type GoalValues = z.infer<typeof GoalSchema>;

/** Create a savings goal (v3 screen 08): details on the left, flexible or locked and the summary on the right. */
export function CreateGoalForm() {
	const router = useRouter();
	const now = useNow(60_000);
	const create = useCreateSavingsPlan();
	const form = useForm<GoalValues>({
		resolver: zodResolver(GoalSchema),
		mode: "onTouched",
		defaultValues: { name: "", targetAmount: "", kind: "flexible", targetDate: "" },
	});
	const [name, targetAmount, kind, targetDate] = useWatch({
		control: form.control,
		name: ["name", "targetAmount", "kind", "targetDate"],
	});

	const submit = form.handleSubmit((v) =>
		create.mutate(
			{
				name: v.name,
				kind: v.kind,
				targetAmount: v.targetAmount,
				...(v.targetDate ? { targetDate: endOfDay(v.targetDate) } : {}),
			},
			{ onSuccess: (plan) => router.push(pageRoutes.dashboardRoutes.SAVINGS_PLAN(plan.id)) },
		),
	);

	const amount = Number(targetAmount);
	const summaryTarget = [
		targetAmount && amount > 0 ? formatMoney(amount, "USDC") : "Your target",
		targetDate ? `${kind === "locked" ? "locked until" : "by"} ${longDate(endOfDay(targetDate))}` : null,
	]
		.filter(Boolean)
		.join(" ");

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
								name="targetAmount"
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
							<FormField
								control={form.control}
								name="targetDate"
								render={({ field, fieldState }) => (
									<FormItem>
										<FormControl>
											<InputField
												{...field}
												type="date"
												label={kind === "locked" ? "Release date" : "Target date (optional)"}
												min={now ? dayString(now + 86_400_000) : undefined}
												error={fieldState.error?.message}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
						</section>
					}
					side={
						<>
							<div className="space-y-5" role="radiogroup" aria-label="Plan type">
								{(Object.keys(KIND) as SavingsPlanKind[]).map((k) => {
									const selected = kind === k;
									return (
										<button
											key={k}
											type="button"
											role="radio"
											aria-checked={selected}
											onClick={() => form.setValue("kind", k, { shouldValidate: form.formState.isSubmitted })}
											className={cn(
												"block w-full rounded-[20px] p-5 text-left transition",
												selected ? "bg-primary-light ring-1 ring-primary-light-active" : "bg-panel hover:bg-neutral-comment",
											)}
										>
											<span className={cn("block text-base md:text-lg", selected && "text-primary-darker")}>
												{KIND[k].label}
												{selected ? " · Selected" : ""}
											</span>
											<span
												className={cn(
													"mt-2 block text-xs font-light md:text-sm",
													selected ? "text-primary-dark" : "text-ink-muted",
												)}
											>
												{KIND[k].choose}
											</span>
										</button>
									);
								})}
							</div>
							<Card title="Plan summary">
								<p>
									{name.trim() || "Your goal"} · {KIND[kind].heading}
								</p>
								<p>Target · {summaryTarget}</p>
								<p>Asset · Simulated USDC on {STELLAR_NETWORK_LABEL}</p>
							</Card>
							<div className="grid grid-cols-2 gap-3">
								<Button type="submit" isLoading={create.isPending} className="w-full text-sm lg:text-base">
									Create savings goal
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
