"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";

export function Providers({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						retry: (count, error) => !(error instanceof ApiError && error.status && error.status < 500) && count < 2,
					},
					mutations: { retry: false },
				},
			}),
	);
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
