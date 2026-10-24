import { Logo } from "./logo";

/**
 * The loading screen.
 * - `screen` (default): fills the viewport with the logo above three pulsing dots, while nothing else
 *   is on screen yet (session check).
 * - `section`: takes real space inside a page, so the header and nav stay put.
 */
function PageLoader({ variant = "screen" }: { variant?: "screen" | "section" }) {
	const dots = (
		<div className="flex items-center gap-2" role="status" aria-label="Loading">
			{[0, 1, 2].map((i) => (
				<span key={i} className="loader-dot size-2.5 rounded-full bg-primary" style={{ "--i": i } as React.CSSProperties} />
			))}
		</div>
	);
	if (variant === "section") {
		return <div className="flex min-h-[50vh] items-center justify-center px-4">{dots}</div>;
	}
	return (
		<div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background px-4">
			<Logo className="h-9 sm:h-11" />
			{dots}
		</div>
	);
}

export { PageLoader };
