import type { SavingsPlanDto, SavingsPlanKind } from "@/lib/api/dto";
import { longDate } from "@/lib/format";

/** Plan kinds: labels and the rules in plain words. Screens take their copy from here. */
export const KIND: Record<SavingsPlanKind, { label: string; heading: string; choose: string; intro: string }> = {
	flexible: {
		label: "Flexible",
		heading: "Flexible savings",
		choose: "Withdraw any time, up to your available balance.",
		intro: "Your personal savings, at your own pace.",
	},
	locked: {
		label: "Locked",
		heading: "Locked savings",
		choose: "Funds stay locked until your chosen date. You cannot withdraw early.",
		intro: "Stay committed. Your savings are locked until your release date.",
	},
};

/** "Travel fund · Flexible" */
export const planTitle = (plan: Pick<SavingsPlanDto, "name" | "kind">) => `${plan.name} · ${KIND[plan.kind].label}`;

/** A locked plan before its release date: nothing can leave. */
export const isLockedNow = (plan: SavingsPlanDto, now: number) =>
	plan.kind === "locked" && !!plan.unlocksAt && (now === 0 || new Date(plan.unlocksAt).getTime() > now);

export function planRules(plan: SavingsPlanDto): string[] {
	const owner = "Only your connected owner wallet can authorize withdrawals.";
	if (plan.kind === "flexible") return ["Withdraw any time, up to the available balance.", owner];
	return [
		`Funds become withdrawable on ${longDate(plan.unlocksAt)}.`,
		"Reaching the target early does not unlock this date-based plan.",
		owner,
	];
}

/** "40% saved · 1,800.00 USDC to go" / "Goal reached" */
export function progressNote(plan: SavingsPlanDto, format: (n: number) => string) {
	const left = Number(plan.targetAmount) - Number(plan.balance);
	return left > 0 ? `${plan.progressPercent}% saved · ${format(left)} to go` : "Goal reached";
}
