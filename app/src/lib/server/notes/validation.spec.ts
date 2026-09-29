import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { noteInsertSchema } from './service';

describe('noteInsertSchema', () => {
	it('trims and accepts any title that is non-blank after trimming', () => {
		fc.assert(
			fc.property(
				fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
				(title) => {
					const parsed = noteInsertSchema.parse({ title });
					expect(parsed.title).toBe(title.trim());
				}
			)
		);
	});

	it('rejects blank titles', () => {
		fc.assert(
			fc.property(
				fc.array(fc.constantFrom(' ', '\t', '\n')).map((chars) => chars.join('')),
				(blank) => {
					expect(noteInsertSchema.safeParse({ title: blank }).success).toBe(false);
				}
			)
		);
	});

	it('accepts an optional body and defaults it away when absent', () => {
		expect(noteInsertSchema.safeParse({ title: 'ok' }).success).toBe(true);
		expect(noteInsertSchema.safeParse({ title: 'ok', body: 'some text' }).success).toBe(true);
	});
});
