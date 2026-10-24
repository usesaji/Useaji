"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";

function ReactQueryProvider({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30 * 1000,
						gcTime: 10 * 60 * 1000,
						// A 4xx won't change on retry (not found, not a member): show it at once.
						retry: (count, error) => !(error instanceof ApiError && error.status && error.status < 500) && count < 2,
						refetchOnWindowFocus: true,
					},
					// Never auto-retry a write — a retried contribution could pay twice.
					mutations: { retry: false },
				},
			}),
	);

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export { ReactQueryProvider };
