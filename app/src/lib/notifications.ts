export const INBOX_LIMIT = 30;

export type NotifKind = 'message' | 'refresh';

export type NotifBodyKey = 'notif_note_created';

export type Notif = {
	id: number;
	kind: NotifKind;
	bodyKey: NotifBodyKey | null;
	params: string | null;
	href: string | null;
	readAt: string | null;
	createdAt: string;
};
