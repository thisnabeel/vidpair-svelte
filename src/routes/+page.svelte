<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/user';
	import { goto } from '$app/navigation';
	import api from '$lib/stores/api';
	import { subscribeToChannel, unsubscribeFromChannel } from '$lib/stores/cable';

	let isPairing = false;
	let pairingStatus = null;
	let chatRoom = null;
	let pairingSubscription = null;

	$: isAuthenticated = $user !== null;

	onMount(() => {
		// Check authentication - user should already be loaded from localStorage
		if (!$user) {
			goto('/login');
		}
	});

	async function beginPairing() {
		if (!isAuthenticated) {
			goto('/login');
			return;
		}

		isPairing = true;
		pairingStatus = 'waiting';

		try {
			// Subscribe to pairing channel for real-time updates
			pairingSubscription = await subscribeToChannel(
				'PairingChannel',
				{},
				{
					received: (data) => {
						if (data.type === 'matched') {
							chatRoom = data.chat_room;
							pairingStatus = 'matched';
							isPairing = false;
							// Navigate to chat room
							goto(`/chat/${data.chat_room.id}`);
						}
					}
				}
			);

			// Start pairing
			const response = await api.post('/pairing/begin');
			
			if (response.data.status === 'matched') {
				chatRoom = response.data.chat_room;
				pairingStatus = 'matched';
				isPairing = false;
				goto(`/chat/${response.data.chat_room.id}`);
			} else {
				pairingStatus = 'waiting';
			}
		} catch (error) {
			console.error('Pairing error:', error);
			isPairing = false;
			pairingStatus = null;
			alert('Failed to start pairing. Please try again.');
		}
	}

	function cancelPairing() {
		if (pairingSubscription) {
			unsubscribeFromChannel('PairingChannel', {});
			pairingSubscription = null;
		}
		api.post('/pairing/leave').catch(console.error);
		isPairing = false;
		pairingStatus = null;
	}
</script>

<svelte:head>
	<title>VidRoom - Home</title>
</svelte:head>

{#if !isAuthenticated}
	<div class="container">
		<h1>Welcome to VidRoom</h1>
		<p>Please <a href="/login">login</a> or <a href="/signup">sign up</a> to begin pairing.</p>
	</div>
{:else}
	<div class="container">
		<h1>Welcome, {$user.username}!</h1>
		
		{#if !isPairing}
			<button class="pair-button" on:click={beginPairing}>
				Begin Pairing
			</button>
		{:else}
			<div class="pairing-status">
				<div class="spinner"></div>
				<p>Looking for someone to pair with...</p>
				<button class="cancel-button" on:click={cancelPairing}>Cancel</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.container {
		max-width: 600px;
		margin: 4rem auto;
		padding: 2rem;
		text-align: center;
	}

	h1 {
		font-size: 2.5rem;
		margin-bottom: 2rem;
		color: #333;
	}

	.pair-button {
		background: #4CAF50;
		color: white;
		border: none;
		padding: 1rem 3rem;
		font-size: 1.2rem;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.2s;
		font-weight: 600;
	}

	.pair-button:hover {
		background: #45a049;
	}

	.pairing-status {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.spinner {
		border: 4px solid #f3f3f3;
		border-top: 4px solid #4CAF50;
		border-radius: 50%;
		width: 50px;
		height: 50px;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.pairing-status p {
		font-size: 1.1rem;
		color: #666;
	}

	.cancel-button {
		background: #f44336;
		color: white;
		border: none;
		padding: 0.5rem 1.5rem;
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.cancel-button:hover {
		background: #da190b;
	}
</style>

