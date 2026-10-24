"use client";

import { useEffect, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import { BodyPortal } from "@repo/ui/body-portal";

/** Steps of the "what's new" tour, in order. Adding a step is one entry here. */
const STEPS = [
	{
		title: "New Features",
		body: "SAJI now lets savings groups govern themselves. Members create proposals, vote on decisions like pausing or resuming the group, and approved actions execute automatically.",
	},
	{
		title: "Missed Contributions",
		body: "A missed contribution is recorded on Stellar and puts the group in recovery: payouts wait until members approve a resolution together, no coordinator required.",
	},
];

/** Bump when the tour's content changes, so people who dismissed the old one see the new one once. */
const SEEN_KEY = "saji_whats_new_seen_v1";

function hasSeen() {
	try {
		return window.localStorage.getItem(SEEN_KEY) === "1";
	} catch {
		return false; // storage blocked: better to show it again than never
	}
}

function markSeen() {
	try {
		window.localStorage.setItem(SEEN_KEY, "1");
	} catch {
		/* see hasSeen */
	}
}

/** One-time "what's new" walkthrough over the dashboard. Seen-state is per browser. */
export function WhatsNewTour() {
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState(0);
	const nextRef = useRef<HTMLButtonElement>(null);

	// Decided after mount: localStorage doesn't exist during server rendering.
	useEffect(() => {
		if (hasSeen()) return;
		const timer = setTimeout(() => setOpen(true), 400);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		if (!open) return;
		nextRef.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				markSeen();
				setOpen(false);
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, step]);

	if (!open) return null;

	const close = () => {
		markSeen();
		setOpen(false);
	};
	const { title, body } = STEPS[step]!;
	const isFirst = step === 0;
	const isLast = step === STEPS.length - 1;

	return (
		<BodyPortal lockScroll>
			<div className="fixed inset-0 z-1100 flex items-center justify-center bg-black/15 px-4 backdrop-blur-md">
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="whats-new-title"
					aria-describedby="whats-new-body"
					className="w-full max-w-lg rounded-[14px] bg-white px-6 pt-7 pb-6 shadow-xl md:px-8 md:pb-8"
				>
					<div className="flex items-start justify-between gap-4">
						<h2 id="whats-new-title" className="text-2xl md:text-[28px]">
							{title}
						</h2>
						<button type="button" onClick={close} aria-label="Close" className="-mr-1 shrink-0 text-2xl md:text-3xl">
							<IoClose />
						</button>
					</div>
					<p id="whats-new-body" className="mt-2 text-sm leading-relaxed md:text-base">
						{body}
					</p>
					<div className={`mt-8 flex items-center ${isFirst ? "" : "justify-between"}`}>
						{!isFirst && (
							<button
								type="button"
								onClick={() => setStep((s) => s - 1)}
								className="h-12 rounded-full bg-neutral-comment px-7 text-base transition hover:bg-neutral-light md:h-14 md:px-9 md:text-lg"
							>
								Previous
							</button>
						)}
						<button
							ref={nextRef}
							type="button"
							onClick={() => (isLast ? close() : setStep((s) => s + 1))}
							className="h-12 rounded-full bg-primary px-7 text-base text-white transition hover:bg-primary-hover md:h-14 md:px-9 md:text-lg"
						>
							{isLast ? "Got it" : "Next"}
						</button>
					</div>
					<p className="sr-only" aria-live="polite">
						Step {step + 1} of {STEPS.length}
					</p>
				</div>
			</div>
		</BodyPortal>
	);
}
