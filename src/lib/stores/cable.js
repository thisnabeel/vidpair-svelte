import { browser } from '$app/environment';
import { user } from './user';
import { get } from 'svelte/store';
import api from './api';

let ActionCable = null;
let cable = null;
let subscriptions = {};

function getWebSocketUrl() {
	if (!browser) return null;
	
	const isProduction = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
	
	if (isProduction) {
		return 'wss://vidpair-api-production.up.railway.app/cable';
	} else {
		return 'ws://localhost:3000/cable';
	}
}

async function loadActionCable() {
	if (!browser) return null;
	
	if (ActionCable) return ActionCable;
	
	try {
		const module = await import('@rails/actioncable');
		ActionCable = module.default || module;
		return ActionCable;
	} catch (e) {
		console.error('Failed to load @rails/actioncable', e);
		return null;
	}
}

export async function getCable() {
	if (!browser) return null;
	
	const ActionCableModule = await loadActionCable();
	if (!ActionCableModule) return null;

	const currentUser = get(user);
	if (!currentUser) return null;

	if (!cable) {
		const baseWsUrl = getWebSocketUrl();
		if (!baseWsUrl) {
			console.error('Could not determine WebSocket URL');
			return null;
		}
		
		const wsUrl = `${baseWsUrl}?email=${encodeURIComponent(currentUser.email)}&token=${encodeURIComponent(currentUser.generated_token)}`;
		cable = ActionCableModule.createConsumer(wsUrl);
	}

	return cable;
}

export async function subscribeToChannel(channelName, params, callbacks) {
	if (!browser) return null;

	const cable = await getCable();
	if (!cable) return null;

	const channel = cable.subscriptions.create(
		{ channel: channelName, ...params },
		{
			connected() {
				console.log(`Connected to ${channelName}`, params);
				if (callbacks?.connected) callbacks.connected();
			},
			disconnected() {
				console.log(`Disconnected from ${channelName}`);
				if (callbacks?.disconnected) callbacks.disconnected();
			},
			received(data) {
				if (callbacks?.received) callbacks.received(data);
			}
		}
	);

	const key = `${channelName}_${JSON.stringify(params)}`;
	subscriptions[key] = channel;

	return channel;
}

export function unsubscribeFromChannel(channelName, params) {
	if (!browser) return;

	const key = `${channelName}_${JSON.stringify(params)}`;
	const channel = subscriptions[key];
	
	if (channel) {
		channel.unsubscribe();
		delete subscriptions[key];
	}
}

export function disconnectCable() {
	if (!browser || !cable) return;

	cable.disconnect();
	cable = null;
	subscriptions = {};
}

user.subscribe((currentUser) => {
	if (!browser) return;
	
	if (!currentUser && cable) {
		disconnectCable();
	}
});

