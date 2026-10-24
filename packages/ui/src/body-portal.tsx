"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noop = () => () => {};

/** Open modals that lock the page; the page scrolls again when the last one closes. */
let locks = 0;
let restore: (() => void) | null = null;

function lockPageScroll() {
	if (locks++ === 0) {
		const html = document.documentElement;
		// The scrollbar's width, put back as padding so the page doesn't shift when it disappears.
		const scrollbar = window.innerWidth - html.clientWidth;
		const previous = { overflow: html.style.overflow, paddingRight: html.style.paddingRight };
		html.style.overflow = "hidden";
		if (scrollbar > 0) html.style.paddingRight = `${scrollbar}px`;
		restore = () => {
			html.style.overflow = previous.overflow;
			html.style.paddingRight = previous.paddingRight;
		};
	}
	return () => {
		if (--locks === 0) {
			restore?.();
			restore = null;
		}
	};
}

/**
 * Renders into <body>. A full-screen overlay (`fixed inset-0`) must escape the page: any ancestor
 * with a transform, filter or animation becomes its containing block and stacking context, so it
 * would cover only that box and sit under the header and nav. `lockScroll` (for modals) stops the
 * page scrolling behind it and hides the scrollbar, so the backdrop reaches every edge. Renders
 * nothing on the server.
 */
export function BodyPortal({ children, lockScroll = false }: { children: React.ReactNode; lockScroll?: boolean }) {
	const mounted = useSyncExternalStore(noop, () => true, () => false);
	useEffect(() => (lockScroll ? lockPageScroll() : undefined), [lockScroll]);
	return mounted ? createPortal(children, document.body) : null;
}
