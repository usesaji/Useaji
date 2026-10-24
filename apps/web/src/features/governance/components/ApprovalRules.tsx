"use client";

import { HiOutlineScale } from "react-icons/hi2";
import { PillInput, SelectField, Stepper } from "@/features/groups/components/form-parts";
import type { GovernanceSettingsDto } from "@/lib/api/dto";

/** The API's defaults (GET /groups/{id}/governance): 51% of the electorate, 72 h to vote, 48 h to execute. */
export const DEFAULT_RULES: GovernanceSettingsDto = { thresholdKind: "percent", thresholdValue: 51, votingPeriodHours: 72, executionWindowHours: 48 };

export function rulesError(rules: GovernanceSettingsDto): string | undefined {
	const max = rules.thresholdKind === "percent" ? 100 : 1000;
	if (!Number.isInteger(rules.thresholdValue) || rules.thresholdValue < 1 || rules.thresholdValue > max) {
		return rules.thresholdKind === "percent" ? "Enter a percentage between 1 and 100." : "Enter a number of members, 1 or more.";
	}
	return undefined;
}

/**
 * "Group decisions": how many yes votes a proposal needs, how long voting stays open, and how long
 * an approved decision has to be carried out (`PUT /groups/{id}/governance`, before the cycle starts).
 */
export function ApprovalRules({ value, onChange }: { value: GovernanceSettingsDto; onChange: (rules: GovernanceSettingsDto) => void }) {
	const set = (patch: Partial<GovernanceSettingsDto>) => onChange({ ...value, ...patch });
	return (
		<div className="rounded-[14px] bg-primary-light px-5 py-5 md:px-6">
			<p className="flex items-center gap-2 text-base text-primary md:text-lg">
				<HiOutlineScale /> Group Decisions
			</p>
			<p className="mt-1 max-w-xl text-xs font-light md:text-sm">
				Members vote to pause or resume the group, change the payout order, or resolve a missed contribution. A decision passes when it reaches this many yes votes.
			</p>
			<div className="mt-5 grid gap-5 md:grid-cols-2">
				<SelectField
					label="Approval threshold"
					value={value.thresholdKind}
					items={[
						{ value: "percent", label: "A share of members (%)" },
						{ value: "count", label: "A number of members" },
					]}
					onChange={(kind) => set({ thresholdKind: kind as GovernanceSettingsDto["thresholdKind"], thresholdValue: kind === "percent" ? 51 : 3 })}
				/>
				<PillInput
					name="thresholdValue"
					label={value.thresholdKind === "percent" ? "Yes votes needed (%)" : "Yes votes needed"}
					inputMode="numeric"
					value={String(value.thresholdValue)}
					suffix={value.thresholdKind === "percent" ? "%" : "members"}
					onChange={(e) => set({ thresholdValue: Number(e.target.value.replace(/\D/g, "")) || 0 })}
					error={rulesError(value)}
				/>
				<div>
					<p className="text-sm font-light">Voting stays open</p>
					<Stepper value={Math.round(value.votingPeriodHours / 24)} min={1} max={30} unit={["day", "days"]} onChange={(d) => set({ votingPeriodHours: d * 24 })} />
				</div>
				<div>
					<p className="text-sm font-light">Time to carry out an approved decision</p>
					<Stepper value={Math.round(value.executionWindowHours / 24)} min={1} max={30} unit={["day", "days"]} onChange={(d) => set({ executionWindowHours: d * 24 })} />
				</div>
			</div>
		</div>
	);
}
