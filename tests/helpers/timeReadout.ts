import { expect, type Page } from "@playwright/test";

/**
 * The replay panel's clock, e.g. "0:01.8 / 0:02.0".
 *
 * `.font-mono` alone is ambiguous (it also matches the empty status-bar div and
 * the "REPLAY MODE" banner), so scope to the element carrying actual time text.
 */
export function timeReadout(page: Page) {
	return page.locator(".font-mono", { hasText: /^\d+:\d{2}\.\d/ });
}

/** Two well-formed clocks: "<current> / <total>". */
export const TIME_READOUT_PATTERN = /^\d+:\d{2}\.\d \/ \d+:\d{2}\.\d$/;

/**
 * Parse the replay readout into seconds.
 *
 * The pattern is the assertion that matters: a media duration the browser has
 * not resolved renders as "Infinity:NaN.NaN", which is what silently broke
 * seeking - every scrubber position scaled against Infinity and clamped to the
 * last frame. Anything that is not two well-formed clocks fails here.
 */
export function parseTimeReadout(text: string | null): {
	current: number;
	total: number;
} {
	const match = text?.match(TIME_READOUT_PATTERN);
	expect(
		match,
		`expected two finite clocks in the replay readout, got ${text}`,
	).not.toBeNull();
	if (!match) throw new Error("unreachable");

	const toSeconds = (clock: string) => {
		const [, min, sec, tenth] = clock.match(/(\d+):(\d{2})\.(\d)/) ?? [];
		return Number(min) * 60 + Number(sec) + Number(tenth) / 10;
	};
	const [current, total] = match[0].split(" / ");
	return { current: toSeconds(current), total: toSeconds(total) };
}
