<script>
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { user } from '$lib/stores/user';
	import { goto } from '$app/navigation';
	import api from '$lib/stores/api';
	import { subscribeToChannel, unsubscribeFromChannel } from '$lib/stores/cable';
	// import Whereby from '$lib/components/Whereby/Whereby.svelte';
	// Keep VideoCall component unused as requested
	import VideoCall from '$lib/components/VideoCall/VideoCall.svelte';

	let messages = [];
	let newMessage = '';
	let chatRoom = null;
	let loading = true;
	let chatSubscription = null;
	let otherUser = null;
	let messagesContainer = null;
	let videoCallComponent = null;
	let activeTab = 'video'; // 'video' or 'messages'

	$: roomId = $page.params.id;

	onMount(async () => {
		if (!$user) {
			goto('/login');
			return;
		}

		await loadChatRoom();
		await loadMessages();
		await subscribeToChat();
	});

	onDestroy(() => {
		if (chatSubscription) {
			unsubscribeFromChannel('ChatChannel', { room_id: roomId });
		}
	});

	async function loadChatRoom() {
		try {
			const response = await api.get(`/chat_rooms/${roomId}`);
			chatRoom = response.data;
			otherUser = chatRoom.user1.id === $user.id ? chatRoom.user2 : chatRoom.user1;
		} catch (error) {
			console.error('Failed to load chat room:', error);
			alert('Failed to load chat room');
			goto('/');
		}
	}

	async function loadMessages() {
		try {
			const response = await api.get(`/chat_rooms/${roomId}/chat_messages`);
			messages = response.data;
			loading = false;
		} catch (error) {
			console.error('Failed to load messages:', error);
			loading = false;
		}
	}

	async function subscribeToChat() {
		chatSubscription = await subscribeToChannel(
			'ChatChannel',
			{ room_id: roomId },
			{
				received: (data) => {
					if (data.type === 'message') {
						messages = [...messages, data];
						scrollToBottom();
					} else if (data.type === 'peerjs_id' && videoCallComponent) {
						// Forward peer ID messages to VideoCall component
						if (videoCallComponent.handleSignalingMessage) {
							videoCallComponent.handleSignalingMessage(data);
						}
					}
				}
			}
		);
	}

	async function sendMessage() {
		if (!newMessage.trim()) return;

		const messageContent = newMessage.trim();
		newMessage = '';

		try {
			const response = await api.post(`/chat_rooms/${roomId}/chat_messages`, {
				content: messageContent
			});
			// Message will be added via WebSocket broadcast
		} catch (error) {
			console.error('Failed to send message:', error);
			alert('Failed to send message');
			newMessage = messageContent; // Restore message
		}
	}

	function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	function formatTime(dateString) {
		const date = new Date(dateString);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>Chat - VidRoom</title>
</svelte:head>

{#if loading}
	<div class="container">
		<p>Loading chat...</p>
	</div>
{:else if chatRoom && otherUser}
	<div class="chat-container">
		<div class="chat-header">
			<h2>Chat with {otherUser.username}</h2>
			<div class="header-actions">
				<button class="back-button" on:click={() => goto('/')}>Back</button>
			</div>
		</div>

		<div class="content-wrapper">
			<div class="video-call-section" class:hidden-mobile={activeTab !== 'video'}>
				<!-- <Whereby 
					roomId={roomId} 
					otherUserId={otherUser.id}
				/> -->
				<VideoCall 
					bind:this={videoCallComponent}
					roomId={roomId} 
					otherUserId={otherUser.id}
					signalingChannel={chatSubscription}
				/>
			</div>
			
			<div class="messages-section" class:hidden-mobile={activeTab !== 'messages'}>
				<div class="messages" bind:this={messagesContainer}>
					{#each messages as message}
						<div class="message" class:own-message={message.user_id === $user.id}>
							<div class="message-header">
								<span class="username">{message.username}</span>
								<span class="timestamp">{formatTime(message.created_at)}</span>
							</div>
							<div class="message-content">{message.content}</div>
						</div>
					{/each}
				</div>

				<form class="message-form" on:submit|preventDefault={sendMessage}>
					<input
						type="text"
						bind:value={newMessage}
						placeholder="Type a message..."
						class="message-input"
					/>
					<button type="submit" class="send-button">Send</button>
				</form>
			</div>
		</div>

		<!-- Mobile Tabs -->
		<div class="mobile-tabs">
			<button 
				class="tab-button" 
				class:active={activeTab === 'video'}
				on:click={() => activeTab = 'video'}
			>
				Video
			</button>
			<button 
				class="tab-button" 
				class:active={activeTab === 'messages'}
				on:click={() => activeTab = 'messages'}
			>
				Messages
			</button>
		</div>
	</div>
{/if}

<style>
	.container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: calc(100vh - 60px);
	}

	.chat-container {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 60px);
		max-width: 800px;
		margin: 0 auto;
		background: white;
		position: relative;
	}

	.content-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.chat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid #ddd;
		background: #f9f9f9;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.video-call-section {
		height: 300px;
		border-bottom: 1px solid #ddd;
		background: #000;
		min-height: 300px;
		flex-shrink: 0;
	}

	@media (max-width: 768px) {
		.video-call-section {
			height: 100%;
			min-height: 0;
			border-bottom: none;
			flex: 1;
			position: absolute;
			top: 60px;
			left: 0;
			right: 0;
			bottom: 60px;
		}

		.video-call-section.hidden-mobile {
			display: none;
		}
	}

	.chat-header h2 {
		margin: 0;
		font-size: 1.2rem;
		color: #333;
	}

	.back-button {
		background: #666;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
	}

	.back-button:hover {
		background: #555;
	}

	.messages-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	@media (max-width: 768px) {
		.messages-section {
			height: calc(100vh - 60px - 60px); /* Full height minus header and tabs */
			position: absolute;
			top: 60px;
			left: 0;
			right: 0;
			bottom: 60px;
			background: white;
			display: flex;
			flex-direction: column;
		}

		.messages-section.hidden-mobile {
			display: none;
		}
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	@media (max-width: 768px) {
		.messages {
			padding-bottom: 2rem;
			flex: 1;
			overflow-y: auto;
			min-height: 0;
			-webkit-overflow-scrolling: touch;
		}
	}

	.message {
		display: flex;
		flex-direction: column;
		max-width: 70%;
		padding: 0.75rem;
		border-radius: 8px;
		background: #f0f0f0;
	}

	.message.own-message {
		align-self: flex-end;
		background: #4CAF50;
		color: white;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.25rem;
		font-size: 0.85rem;
		opacity: 0.8;
	}

	.message-content {
		word-wrap: break-word;
	}

	.message-form {
		display: flex;
		padding: 1rem;
		border-top: 1px solid #ddd;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	@media (max-width: 768px) {
		.message-form {
			position: relative;
			background: white;
			z-index: 10;
			flex-shrink: 0;
			border-top: 1px solid #ddd;
			box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
			margin-bottom: 0;
		}
	}

	.message-input {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	.message-input:focus {
		outline: none;
		border-color: #4CAF50;
	}

	.send-button {
		padding: 0.75rem 1.5rem;
		background: #4CAF50;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
	}

	.send-button:hover {
		background: #45a049;
	}

	.mobile-tabs {
		display: none;
	}

	@media (max-width: 768px) {
		.mobile-tabs {
			display: flex;
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			background: white;
			border-top: 1px solid #ddd;
			z-index: 100;
			max-width: 800px;
			margin: 0 auto;
			height: 60px;
			box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
		}

		.tab-button {
			flex: 1;
			padding: 1rem;
			border: none;
			background: white;
			color: #666;
			font-size: 1rem;
			font-weight: 500;
			cursor: pointer;
			border-bottom: 3px solid transparent;
			transition: all 0.2s;
		}

		.tab-button.active {
			color: #4CAF50;
			border-bottom-color: #4CAF50;
			background: #f9f9f9;
		}

		.tab-button:active {
			background: #f0f0f0;
		}

		.chat-container {
			padding-bottom: 60px;
		}
	}
</style>

