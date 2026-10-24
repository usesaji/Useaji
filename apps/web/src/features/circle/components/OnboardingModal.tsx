"use client";

import { useState } from "react";
import { HiXMark } from "react-icons/hi2";
import { BodyPortal } from "@repo/ui/body-portal";

const STEPS = [
	{
		title: "You get alerted before each deadline",
		body: "We remind you before each contribution is due so you can keep enough balance and avoid the late fee.",
	},
	{
		title: "Payouts settle in minutes",
		body: "Once everyone due has contributed, the round's pot is paid on Stellar to the member whose turn it is.",
	},
	{
		title: "The group decides together",
		body: "If someone misses a contribution, payouts wait while members vote on how to recover. No coordinator decides alone.",
	},
];

/** First visit to a brand-new circle: a three-card walkthrough, shown once per group (per browser). */
export function OnboardingModal({ groupId }: { groupId: string }) {
	const key = `saji:onboarded:circle:${groupId}`;
	const [step, setStep] = useState(() => {
		try {
			return typeof window !== "undefined" && !localStorage.getItem(key) ? 0 : -1;
		} catch {
			return -1;
		}
	});
	if (step < 0) return null;

	const close = () => {
		try {
			localStorage.setItem(key, "1");
		} catch {
			/* storage off — it may show again, which is harmless */
		}
		setStep(-1);
	};
	const { title, body } = STEPS[step]!;
	const last = step === STEPS.length - 1;

	return (
		<BodyPortal lockScroll>
			<div className="fixed inset-0 z-1100 flex items-center justify-center bg-black/15 px-4 backdrop-blur-md">
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="circle-onboarding-title"
					className="w-full max-w-lg rounded-[14px] bg-white px-6 pt-7 pb-6 shadow-xl md:px-8 md:pb-8"
				>
					<div className="flex items-start justify-between gap-4">
						<h3 id="circle-onboarding-title" className="text-2xl md:text-[28px]">
							{title}
						</h3>
						<button onClick={close} type="button" aria-label="Close" className="text-2xl">
							<HiXMark />
						</button>
					</div>
					<p className="mt-2 text-sm leading-relaxed md:text-base">{body}</p>
					<div className={`mt-8 flex items-center ${step > 0 ? "justify-between" : ""}`}>
						{step > 0 && (
							<button
								type="button"
								onClick={() => setStep((s) => s - 1)}
								className="h-12 rounded-full bg-neutral-comment px-7 text-base transition hover:bg-neutral-light"
							>
								Previous
							</button>
						)}
						<button
							type="button"
							onClick={() => (last ? close() : setStep((s) => s + 1))}
							className="h-12 rounded-full bg-primary px-7 text-base text-white transition hover:bg-primary-hover"
						>
							{last ? "Got it" : "Next"}
						</button>
					</div>
				</div>
			</div>
		</BodyPortal>
	);
}
