/** Unwraps TanStack createServerFn so handlers can be called directly in tests. */
export function createServerFnMock() {
	return {
		createServerFn: () => {
			const chain = {
				validator: () => chain,
				handler: <T>(fn: T) => fn,
			};
			return chain;
		},
	};
}
