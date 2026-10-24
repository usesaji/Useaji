import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { FiLoader } from "react-icons/fi";
import { cn } from "./lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[40px] lg:rounded-[66px] text-sm sm:text-base lg:text-lg transition-all disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive cursor-pointer duration-150 hover:scale-[0.95] active:scale-[0.98]",
	{
		variants: {
			variant: {
				default: "bg-primary text-white hover:bg-primary-hover disabled:bg-[#DCDDDE] disabled:text-[#B7B9BB]",
				destructive: "bg-error-500 text-white hover:bg-error-500/80 focus-visible:ring-destructive/20",
				outline: "border border-primary text-primary bg-white hover:bg-primary-light disabled:opacity-50",
				secondary: "bg-primary-darker text-white hover:bg-primary-dark-hover",
				/** Grey pill ("Previous", "Invite Members"). */
				soft: "bg-neutral-comment text-ink hover:bg-neutral-light disabled:opacity-60",
				ghost: "bg-primary-light text-primary hover:bg-primary hover:text-white",
				dark: "bg-neutral-dark text-white hover:bg-neutral-dark-hover",
			},
			size: {
				default: "w-fit h-[43px] px-5.5 py-3 lg:h-[48px] has-[>svg]:px-3",
				sm: "h-[43px] rounded-[24px] gap-1.5 px-3 has-[>svg]:px-2.5",
				lg: "h-[60px] rounded-[30px] px-6 has-[>svg]:px-4",
				icon: "size-9",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

/**
 * The pill button. For a link, wrap the app's `<Link>`: `<Button asChild><Link href="…">…</Link></Button>`
 * (next/* stays out of this package). `isLoading` swaps the label for a spinner and blocks clicks.
 */
function Button({
	className,
	variant,
	size,
	asChild = false,
	isLoading = false,
	children,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
		isLoading?: boolean;
	}) {
	const classes = cn(buttonVariants({ variant, size, className }), isLoading && "cursor-not-allowed opacity-90");

	if (asChild) {
		return (
			<Slot data-slot="button" className={classes} aria-disabled={isLoading || undefined} {...props}>
				{children}
			</Slot>
		);
	}

	return (
		<button data-slot="button" type="button" className={classes} {...props} disabled={isLoading || props.disabled}>
			{isLoading ? (
				<span className="flex items-center gap-2" role="status" aria-label="Working">
					<FiLoader className="size-5 animate-spin" />
				</span>
			) : (
				children
			)}
		</button>
	);
}

export { Button, buttonVariants };
