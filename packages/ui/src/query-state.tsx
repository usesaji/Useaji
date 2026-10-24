import { cn } from "./lib/utils";

/** A query's loading skeleton or error-with-retry; renders nothing once there is data. */
export function QueryState({
	isLoading,
	error,
	onRetry,
	className,
	skeletonClassName = "h-48",
}: {
	isLoading: boolean;
	error: unknown;
	onRetry?: () => void;
	className?: string;
	skeletonClassName?: string;
}) {
	if (isLoading) return <div aria-busy="true" aria-label="Loading" className={cn("skeleton rounded-[20px] bg-panel", skeletonClassName, className)} />;
	if (!error) return null;
	return (
		<div role="alert" className={cn("rounded-[20px] bg-panel p-6 text-sm", className)}>
			<p className="text-error-500">{error instanceof Error ? error.message : "Something went wrong."}</p>
			{onRetry && (
				<button type="button" onClick={onRetry} className="mt-2 font-medium underline">
					Try again
				</button>
			)}
		</div>
	);
}
