import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissToast, showError, showToast, toasts } from './toasts.svelte';

function clear() {
	for (const t of toasts.items) dismissToast(t.id);
}

describe('toasts', () => {
	beforeEach(() => vi.useFakeTimers());

	afterEach(() => {
		clear();
		vi.useRealTimers();
	});

	it('auto-dismisses an info toast', () => {
		showToast('saved');
		expect(toasts.items).toHaveLength(1);
		vi.advanceTimersByTime(6000);
		expect(toasts.items).toHaveLength(0);
	});

	it('errors carry the error tone and outlive an info toast', () => {
		showToast('saved');
		showError('boom');
		vi.advanceTimersByTime(6000);
		expect(toasts.items.map((t) => t.text)).toEqual(['boom']);
		expect(toasts.items[0]!.tone).toBe('error');
		vi.advanceTimersByTime(4000);
		expect(toasts.items).toHaveLength(0);
	});

	it('dismisses only the toast asked for', () => {
		const first = showToast('one');
		showToast('two');
		dismissToast(first);
		expect(toasts.items.map((t) => t.text)).toEqual(['two']);
	});
});
