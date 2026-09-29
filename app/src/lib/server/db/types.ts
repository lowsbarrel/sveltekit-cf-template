import Decimal from 'decimal.js';
import { customType } from 'drizzle-orm/pg-core';

export function decimalNumeric(name: string, opts: { precision: number; scale: number }) {
	return customType<{ data: Decimal; driverData: string }>({
		dataType: () => `numeric(${opts.precision}, ${opts.scale})`,
		fromDriver: (value) => new Decimal(value),
		toDriver: (value) => value.toFixed(opts.scale)
	})(name);
}

export function bytea(name: string) {
	return customType<{ data: Uint8Array; driverData: Uint8Array }>({
		dataType: () => 'bytea'
	})(name);
}
