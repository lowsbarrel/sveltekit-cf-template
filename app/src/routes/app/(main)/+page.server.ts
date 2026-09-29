import { error, fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import * as m from '$lib/paraglide/messages';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import { addTodo, listTodos, setTodoDone, todoInsertSchema } from '$lib/server/todos/service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, parent }) => {
	const { user } = await parent();
	const ctx = createCtx(platform);
	try {
		const [todos, form] = await Promise.all([
			listTodos(ctx, { id: user.id }),
			superValidate(zod4(todoInsertSchema))
		]);
		return { todos, form };
	} catch (e) {
		httpError(e);
	}
};

export const actions: Actions = {
	add: async ({ request, platform, locals }) => {
		const user = locals.user;
		if (!user) redirect(302, '/login');
		const orgId = locals.session?.activeOrganizationId;
		if (!orgId) error(404, { message: 'No active organization', code: 'not_found' });

		const form = await superValidate(request, zod4(todoInsertSchema));
		if (!form.valid) return fail(400, { form });
		try {
			await addTodo(createCtx(platform), platform!.env, { id: user.id }, orgId, form.data);
		} catch (e) {
			httpError(e);
		}
		return message(form, m.todo_added());
	},

	toggle: async ({ request, platform, locals }) => {
		const user = locals.user;
		if (!user) redirect(302, '/login');

		const data = await request.formData();
		try {
			await setTodoDone(
				createCtx(platform),
				{ id: user.id },
				Number(data.get('id')),
				data.get('done') === 'true'
			);
		} catch (e) {
			httpError(e);
		}
	}
};
