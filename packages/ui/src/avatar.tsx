
import { cn } from "./lib/utils";

/**
 * A person's picture, or their initials when they haven't uploaded one — never a stock face, which
 * would show a stranger as a member. Size and shape come from `className`.
 */
export function Avatar({
	src,
	initials,
	label,
	className = "size-9",
	textClassName = "text-xs",
}: {
	/** A signed URL from the API, or empty for initials. */
	src?: string | null;
	initials: string;
	/** Accessible name (a tag or full name). */
	label?: string;
	className?: string;
	textClassName?: string;
}) {
	return (
		<span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-light", className)} title={label}>
			{src ? (
				<img src={src} alt={label ?? ""} className="h-full w-full object-cover" />
			) : (
				<span aria-label={label} className={cn("font-medium text-primary", textClassName)}>
					{initials || "?"}
				</span>
			)}
		</span>
	);
}
