"use client";

import {
	Pagination as Root,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "./pagination";

/** `paginationMeta` of an API list. */
export interface PageMeta {
	nextPage: boolean;
	previousPage: boolean;
	totalCount: number;
	count: number;
	totalPages: number;
	currentPage: number;
}

const DOTS = "dots";

/** [1, "dots", 4, 5, 6, "dots", 10] around the current page. */
function pageRange(current: number, total: number, siblings = 1): (number | typeof DOTS)[] {
	const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
	if (siblings * 2 + 5 >= total) return range(1, total);
	const left = Math.max(current - siblings, 1);
	const right = Math.min(current + siblings, total);
	const showLeft = left > 2;
	const showRight = right < total - 1;
	if (!showLeft && showRight) return [...range(1, 3 + 2 * siblings), DOTS, total];
	if (showLeft && !showRight) return [1, DOTS, ...range(total - (3 + 2 * siblings) + 1, total)];
	return [1, DOTS, ...range(left, right), DOTS, total];
}

/** Pages of an API list (`paginationMeta`). Renders nothing for a single page. */
export function Pager({ meta, onPageChange, className }: { meta: PageMeta | undefined; onPageChange: (page: number) => void; className?: string }) {
	if (!meta || meta.totalPages <= 1) return null;
	const { currentPage, totalPages } = meta;
	const go = (page: number) => {
		if (page >= 1 && page <= totalPages && page !== currentPage) onPageChange(page);
	};

	return (
		<Root className={className}>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious className={!meta.previousPage ? "pointer-events-none opacity-40" : ""} onClick={() => go(currentPage - 1)} />
				</PaginationItem>
				{pageRange(currentPage, totalPages).map((page, i) =>
					page === DOTS ? (
						<PaginationItem key={`dots-${i}`}>
							<PaginationEllipsis />
						</PaginationItem>
					) : (
						<PaginationItem key={page}>
							<PaginationLink isActive={page === currentPage} onClick={() => go(page)}>
								{page}
							</PaginationLink>
						</PaginationItem>
					),
				)}
				<PaginationItem>
					<PaginationNext className={!meta.nextPage ? "pointer-events-none opacity-40" : ""} onClick={() => go(currentPage + 1)} />
				</PaginationItem>
			</PaginationContent>
		</Root>
	);
}
