// The browser test project runs without the SvelteKit plugin, so `$app/*` needs a stand-in.
export async function invalidate() {}
export async function invalidateAll() {}
export async function goto() {}
