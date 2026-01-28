import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export default function storage(key, initial) {
	const store = writable(initial);
	const { subscribe, set, update } = store;

	return {
		subscribe,
		set,
		update,
		useLocalStorage: () => {
			if (!browser) return;

			const json = localStorage.getItem(key);
			if (json) {
				set(JSON.parse(json));
			}

			subscribe((current) => {
				localStorage.setItem(key, JSON.stringify(current));
			});
		}
	};
}

