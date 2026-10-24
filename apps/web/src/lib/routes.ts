/** App page routes. API paths live in each feature's `api.ts`. */
export const pageRoutes = {
	authRoutes: {
		LOGIN: "/auth/login",
		REGISTER: "/auth/register",
		OTP: (email: string) => `/auth/register/verify-otp?email=${encodeURIComponent(email)}`,
		CREATE_PROFILE: "/auth/register/create-profile",
		FORGOT_PASSWORD: "/auth/forgot-password",
		/** Where the reset email links (`{WEB_APP_URL}/reset-password#email=…&token=…`), so outside /auth. */
		RESET_PASSWORD: "/reset-password",
	},

	dashboardRoutes: {
		OVERVIEW: "/overview",
		GROUPS: "/groups",
		NEW_GROUP: "/groups/create",
		DISCOVER: "/groups/discover",
		JOIN_GROUP: (code: string) => `/groups/join/${code}`,
		/** Forming group: members, invite link, requests, start. */
		GROUP: (id: string) => `/groups/${id}`,
		/** Active group: the savings cycle. */
		CIRCLE: (id: string) => `/groups/${id}/circle`,
		GROUP_REQUESTS: (id: string) => `/groups/${id}/requests`,
		PAYOUT_ORDER: (id: string) => `/groups/${id}/payout-order`,
		GROUP_RULES: (id: string) => `/groups/${id}/rules`,
		GROUP_COMPLETE: (id: string) => `/groups/${id}/complete`,
		PROPOSALS: (id: string) => `/groups/${id}/proposals`,
		NEW_PROPOSAL: (id: string, type?: string) => `/groups/${id}/proposals/new${type ? `?type=${type}` : ""}`,
		PROPOSAL: (id: string, proposalId: string) => `/groups/${id}/proposals/${proposalId}`,
		VOTE: (id: string, proposalId: string) => `/groups/${id}/proposals/${proposalId}/vote`,
		RECOVERY: (id: string) => `/groups/${id}/recovery`,
		RECOVERY_OPTIONS: (id: string, defaultId?: string) => `/groups/${id}/recovery/options${defaultId ? `?default=${defaultId}` : ""}`,
		RECOVERY_PROPOSE: (id: string, defaultId: string, action: string) =>
			`/groups/${id}/recovery/propose?default=${defaultId}&action=${action}`,
		GROUP_HISTORY: (id: string) => `/groups/${id}/history`,
		GROUP_EDIT: (id: string) => `/groups/${id}/edit`,

		ACTIVITY: "/activity",
		NOTIFICATIONS: "/notifications",
		SEARCH: (q: string) => `/search?q=${encodeURIComponent(q)}`,
		WALLET: "/wallet",
		TRANSACTION: (id: string) => `/transactions/${id}`,

		ME: "/profile",
		PROFILE_EDIT: "/profile/edit",
		PROFILE_PERSONAL_INFO: "/profile/personal-info",
		PROFILE_SECURITY: "/profile/security",
		PROFILE_PASSWORD_SECURITY: "/profile/password-security",
		PROFILE_STATEMENT: "/profile/statement",
		WITHDRAW_INFO: "/profile/withdraw-info",
	},
};
