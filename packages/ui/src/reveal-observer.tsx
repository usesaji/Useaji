"use client";

import { useEffect } from "react";

/**
 * Mount once per page: every `[data-reveal]` element fades / slides in (`.is-visible`) the first time
 * it scrolls into view. The styles live in globals.css (off for reduced motion). Pages stay server
 * components — they only add the attribute (and `style={{ "--i": n }}` to stagger).
 */
export function RevealObserver() {
	useEffect(() => {
		const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)"));
		if (typeof IntersectionObserver === "undefined") {
			targets.forEach((el) => el.classList.add("is-visible"));
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					entry.target.classList.add("is-visible");
					observer.unobserve(entry.target);
				}
			},
			{ threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
		);
		targets.forEach((el) => observer.observe(el));
		return () => observer.disconnect();
	}, []);
	return null;
}
