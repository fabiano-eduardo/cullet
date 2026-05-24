import pino, { type Logger } from 'pino';

import type { PolicyEvent, PolicyReporter } from '../../core/config/policy-reporter';

export class PinoPolicyReporter implements PolicyReporter {
	readonly #logger: Logger;

	constructor(logger?: Logger) {
		this.#logger = logger ?? pino({ name: 'bellium.policies' });
	}

	report(event: PolicyEvent): void {
		const { level } = event;
		const message = 'message' in event ? event.message : event.kind;

		if (level === 'error') {
			this.#logger.error(event, message);
		} else if (level === 'warn') {
			this.#logger.warn(event, message);
		} else {
			this.#logger.info(event, message);
		}
	}
}
