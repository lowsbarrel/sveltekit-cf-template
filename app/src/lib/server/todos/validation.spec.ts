import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { todoInsertSchema } from './service';

describe('todoInsertSchema', () => {
	it('trims and accepts any title that is non-blank after trimming', () => {
		fc.assert(
			fc.property(
				fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
				(title) => {
					const parsed = todoInsertSchema.parse({ title });
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
					expect(todoInsertSchema.safeParse({ title: blank }).success).toBe(false);
				}
			)
		);
	});
});
