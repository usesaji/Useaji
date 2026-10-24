"use client";

import { useLayoutEffect, useRef } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A number that counts to its value: from 0 when it appears, from the old value when it changes.
 * Writes the text directly (no re-render per frame). The server render and reduced motion show the
 * final value. `startOnView` waits until the number scrolls into view (landing stats).
 */
export function AnimatedNumber({
	value,
	format = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 }),
	duration = 900,
	startOnView = false,
	className,
}: {
	value: number;
	format?: (n: number) => string;
	duration?: number;
	startOnView?: boolean;
	className?: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const from = useRef(0);
	const formatRef = useRef(format);

	useLayoutEffect(() => {
		formatRef.current = format;
	});

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const fmt = formatRef.current;
		if (reduced() || !Number.isFinite(value)) {
			el.textContent = fmt(value);
			from.current = value;
			return;
		}
		const start = from.current;
		el.textContent = fmt(start);
		let frame = 0;
		const run = () => {
			const t0 = performance.now();
			const tick = (now: number) => {
				const t = Math.min(1, (now - t0) / duration);
				el.textContent = fmt(start + (value - start) * easeOut(t));
				if (t < 1) frame = requestAnimationFrame(tick);
				else from.current = value;
			};
			frame = requestAnimationFrame(tick);
		};
		if (!startOnView || typeof IntersectionObserver === "undefined") {
			run();
			return () => cancelAnimationFrame(frame);
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					observer.disconnect();
					run();
				}
			},
			{ threshold: 0.4 },
		);
		observer.observe(el);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, [value, duration, startOnView]);

	return (
		<span ref={ref} className={className} suppressHydrationWarning>
			{format(value)}
		</span>
	);
}
