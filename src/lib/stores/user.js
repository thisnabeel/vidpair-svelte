import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Load user from localStorage synchronously on initialization
let initialUser = null;
if (browser) {
	try {
		const stored = localStorage.getItem('user');
		if (stored) {
			initialUser = JSON.parse(stored);
		}
	} catch (e) {
		console.error('Failed to load user from localStorage:', e);
	}
}

// Create writable store with initial value from localStorage
export const user = writable(initialUser);

// Sync with localStorage on changes
if (browser) {
	user.subscribe((value) => {
		if (value) {
			localStorage.setItem('user', JSON.stringify(value));
		} else {
			localStorage.removeItem('user');
		}
	});
}

