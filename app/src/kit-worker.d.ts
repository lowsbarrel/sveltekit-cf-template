declare module '#kit-worker' {
	const worker: { fetch: NonNullable<ExportedHandler<Env>['fetch']> };
	export default worker;
}
