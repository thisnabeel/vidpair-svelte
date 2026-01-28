<script>
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import api from '$lib/stores/api';
	import { user } from '$lib/stores/user';

	export let roomId;
	export let otherUserId;

	let roomUrl = null;
	let hostRoomUrl = null;
	let loading = true;
	let error = null;
	let iframeRef = null;

	onMount(async () => {
		// Request camera and microphone permissions before creating room
		await requestMediaPermissions();
		await createWherebyRoom();
	});

	async function requestMediaPermissions() {
		try {
			// Request camera and microphone permissions
			const stream = await navigator.mediaDevices.getUserMedia({ 
				video: true, 
				audio: true 
			});
			// Stop the stream immediately - we just needed permission
			stream.getTracks().forEach(track => track.stop());
		} catch (error) {
			console.warn('Media permission request failed:', error);
			// Continue anyway - Whereby will handle permission request
		}
	}

	onDestroy(() => {
		// Cleanup if needed
		roomUrl = null;
		hostRoomUrl = null;
	});

	async function createWherebyRoom() {
		try {
			loading = true;
			error = null;

			const response = await api.post('/whereby/create_room');
			
			if (response.data.roomUrl) {
				// Use hostRoomUrl if available, otherwise use regular roomUrl
				let baseUrl = response.data.hostRoomUrl || response.data.roomUrl;
				
				// Add username and auto-start parameters to URL
				const currentUser = get(user);
				const url = new URL(baseUrl);
				
				if (currentUser && currentUser.username) {
					url.searchParams.set('displayName', currentUser.username);
				}
				
				// Auto-start video and audio (Whereby will use permissions already granted)
				// These parameters help Whereby know to start immediately
				url.searchParams.set('embed', 'true');
				url.searchParams.set('screenshare', 'false');
				
				roomUrl = url.toString();
				loading = false;
			} else {
				throw new Error('No room URL received');
			}
		} catch (err) {
			console.error('Error creating Whereby room:', err);
			error = 'Failed to create video room. Please try again.';
			loading = false;
		}
	}

	function handleIframeLoad() {
		loading = false;
	}
</script>

<div class="whereby-container">
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading video room...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<p>{error}</p>
			<button class="retry-btn" on:click={createWherebyRoom}>Retry</button>
		</div>
	{:else if roomUrl}
		<div class="whereby-iframe-wrapper">
			<iframe
				bind:this={iframeRef}
				src={roomUrl}
				class="whereby-iframe"
				allow="camera; microphone; fullscreen; speaker; display-capture"
				on:load={handleIframeLoad}
			></iframe>
		</div>
	{/if}
</div>

<style>
	.whereby-container {
		width: 100%;
		height: 100%;
		position: relative;
		background: #000;
		border-radius: 8px;
		overflow: hidden;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: white;
		gap: 1rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: white;
		gap: 1rem;
		padding: 2rem;
		text-align: center;
	}

	.retry-btn {
		padding: 0.5rem 1.5rem;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: background 0.2s;
	}

	.retry-btn:hover {
		background: #2563eb;
	}

	.whereby-iframe-wrapper {
		width: 100%;
		height: 100%;
		position: relative;
	}

	.whereby-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: #000;
	}
</style>

