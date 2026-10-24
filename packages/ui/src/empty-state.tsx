import { HiInformationCircle } from "react-icons/hi2";
import { cn } from "./lib/utils";

/** Empty lists and tabs: a grey disc with an icon, a line of text, and an optional action. */
export function EmptyState({
	icon: Icon = HiInformationCircle,
	title,
	children,
	action,
	className,
}: {
	icon?: React.ComponentType<{ className?: string }>;
	title: string;
	children?: React.ReactNode;
	action?: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col items-center px-4 py-12 text-center", className)}>
			<span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-neutral-comment text-2xl text-neutral-700">
				<Icon />
			</span>
			<p className="mt-3 text-sm text-neutral-800">{title}</p>
			{children && <p className="mt-1 max-w-sm text-xs font-light text-ink-muted">{children}</p>}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}
