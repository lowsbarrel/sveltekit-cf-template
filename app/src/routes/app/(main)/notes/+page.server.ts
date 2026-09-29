import { error, fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import * as m from '$lib/paraglide/messages';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import { createNote, deleteNote, listNotes, noteInsertSchema } from '$lib/server/notes/service';
import type { Actions, PageServerLoad } from './$types';

function context(locals: App.Locals) {
	const user = locals.user;
	if (!user) redirect(302, '/login');
	const orgId = locals.session?.activeOrganizationId;
	if (!orgId) error(404, { message: 'No active organization', code: 'not_found' });
	return { actor: { id: user.id }, orgId };
}

export const load: PageServerLoad = async ({ platform, locals, depends }) => {
	const { actor, orgId } = context(locals);
	depends('app:notes');
	const ctx = createCtx(platform);
	try {
		const [notes, form] = await Promise.all([
			listNotes(ctx, actor, orgId),
			superValidate(zod4(noteInsertSchema))
		]);
		return { notes, form };
	} catch (e) {
		httpError(e);
	}
};

export const actions: Actions = {
	create: async ({ request, platform, locals }) => {
		const { actor, orgId } = context(locals);

		const form = await superValidate(request, zod4(noteInsertSchema));
		if (!form.valid) return fail(400, { form });
		try {
			await createNote(createCtx(platform), actor, orgId, form.data);
		} catch (e) {
			httpError(e);
		}
		return message(form, m.note_added());
	},

	delete: async ({ request, platform, locals }) => {
		const { actor, orgId } = context(locals);

		const data = await request.formData();
		try {
			await deleteNote(createCtx(platform), actor, orgId, Number(data.get('id')));
		} catch (e) {
			httpError(e);
		}
	}
};
