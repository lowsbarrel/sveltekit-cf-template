<script lang="ts">
	import { onMount } from 'svelte';

	// eslint-disable-next-line no-useless-assignment -- $bindable default is read via the parent's bind:
	let { siteKey, token = $bindable('') }: { siteKey: string; token?: string } = $props();

	const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
	let el: HTMLDivElement;

	onMount(() => {
		let widgetId: string | undefined;

		const render = () => {
			widgetId = window.turnstile?.render(el, {
				sitekey: siteKey,
				callback: (t) => (token = t),
				'expired-callback': () => (token = ''),
				'error-callback': () => (token = '')
			});
		};

		if (window.turnstile) {
			render();
		} else {
			let script = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
			if (!script) {
				script = document.createElement('script');
				script.src = SRC;
				script.async = true;
				script.defer = true;
				document.head.appendChild(script);
			}
			const ready = setInterval(() => {
				if (window.turnstile) {
					clearInterval(ready);
					render();
				}
			}, 50);
			return () => clearInterval(ready);
		}

		return () => {
			if (widgetId) window.turnstile?.remove(widgetId);
		};
	});
</script>

<div bind:this={el}></div>
