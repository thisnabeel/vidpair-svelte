import axios from 'axios';
import { browser } from '$app/environment';
import { user } from './user';
import { get } from 'svelte/store';

function getApiBaseUrl() {
	if (!browser) return 'http://localhost:3000';
	
	const isProduction = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
	
	if (isProduction) {
		// Update this with your production API URL
		return 'https://vidpair-api-production.up.railway.app/';
	} else {
		return 'http://localhost:3000';
	}
}

const api = axios.create({
	baseURL: getApiBaseUrl(),
	headers: {
		'Content-Type': 'application/json'
	}
});

// Add auth headers to requests
api.interceptors.request.use((config) => {
	const currentUser = get(user);
	if (currentUser && currentUser.email && currentUser.generated_token) {
		config.headers['X-User-Email'] = currentUser.email;
		config.headers['X-User-Token'] = currentUser.generated_token;
	}
	return config;
});

export default api;

