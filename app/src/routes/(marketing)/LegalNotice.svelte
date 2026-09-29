<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
</script>

<aside class="flex gap-3 rounded border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
	<TriangleAlert class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
	<p>{m.legal_review_notice()}</p>
</aside>
