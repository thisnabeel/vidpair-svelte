<script>
	import { onMount, onDestroy } from 'svelte';
	import { subscribeToChannel, unsubscribeFromChannel } from '$lib/stores/cable';
	import { user } from '$lib/stores/user';

	export let roomId;
	export let otherUserId;
	export let signalingChannel = null;

	let peer = null;
	let myPeerId = null;
	let otherPeerId = null;
	let localStream = null;
	let remoteStream = null;
	let currentCall = null;
	let isCallActive = false;
	let connectionStatus = 'connecting';
	let isVideoEnabled = true;
	let isAudioEnabled = false;
	let localVideoElement;
	let remoteVideoElement;

	// Update remote video element when remoteStream changes
	$: if (remoteStream && remoteVideoElement) {
		remoteVideoElement.srcObject = remoteStream;
		remoteVideoElement.play().catch(err => {
			console.error('Error playing remote video:', err);
		});
	}

	// Update local video element when localStream changes
	$: if (localStream && localVideoElement) {
		if (localVideoElement.srcObject !== localStream) {
			localVideoElement.srcObject = localStream;
			localVideoElement.play().catch(err => {
				console.error('Error playing local video:', err);
			});
		}
	}

	onMount(async () => {
		// Initialize PeerJS
		if (typeof Peer === 'undefined') {
			console.error('PeerJS not loaded');
			return;
		}

		// Create peer with random ID
		peer = new Peer({
			config: {
				iceServers: [
					{ urls: 'stun:stun.l.google.com:19302' },
					{ urls: 'stun:stun1.l.google.com:19302' }
				]
			},
			debug: 2
		});

		// When peer is ready, send our ID to the other user
		peer.on('open', (id) => {
			console.log('My peer ID is:', id);
			myPeerId = id;
			connectionStatus = 'connecting';
			
			// Send our peer ID to the other user via ActionCable
			if (signalingChannel) {
				signalingChannel.send({
					type: 'peerjs_id',
					peer_id: id,
					from_user_id: $user.id
				});
			}
		});

		// Handle incoming calls
		peer.on('call', (call) => {
			console.log('Received call from:', call.peer);
			otherPeerId = call.peer;
			
			// Get local media stream
			getLocalStream().then((stream) => {
				// Answer the call with our stream
				call.answer(stream);
				currentCall = call;
				isCallActive = true;
				connectionStatus = 'connected';

				// Handle remote stream
				call.on('stream', (stream) => {
					console.log('Received remote stream');
					remoteStream = stream;
					connectionStatus = 'connected';
				});

				call.on('close', () => {
					console.log('Call closed');
					endCall();
				});

				call.on('error', (err) => {
					console.error('Call error:', err);
					connectionStatus = 'disconnected';
				});
			}).catch((error) => {
				console.error('Error getting local stream for call:', error);
			});
		});

		// Handle peer errors
		peer.on('error', (err) => {
			console.error('Peer error:', err);
			if (err.type === 'peer-unavailable') {
				connectionStatus = 'disconnected';
			}
		});

		// Get local media stream
		await getLocalStream();

		// Subscribe to signaling channel if not provided
		if (!signalingChannel) {
			await subscribeToSignaling();
		} else {
			// Set up message handler for existing channel
			setupSignalingHandler();
		}
	});

	async function subscribeToSignaling() {
		signalingChannel = await subscribeToChannel(
			'ChatChannel',
			{ room_id: roomId },
			{
				received: (data) => {
					handleSignalingMessage(data);
				}
			}
		);
	}

	function setupSignalingHandler() {
		// The signaling channel is passed as a prop, so messages will be forwarded
		// from the parent component via handleSignalingMessage method
	}

	// Expose this method so parent can forward messages
	export function handleSignalingMessage(data) {
		if (data.type === 'peerjs_id' && data.from_user_id === otherUserId) {
			// Received other user's peer ID
			otherPeerId = data.peer_id;
			console.log('Received other peer ID:', otherPeerId);
			
			// If we have our peer ID and local stream, initiate call
			if (myPeerId && localStream && !isCallActive && !currentCall) {
				startCall();
			}
		}
	}


	async function startCall() {
		if (!otherPeerId || !localStream || !peer) {
			console.log('Cannot start call - missing peer ID, stream, or peer object');
			return;
		}

		try {
			console.log('Calling peer:', otherPeerId);
			currentCall = peer.call(otherPeerId, localStream);
			
			if (!currentCall) {
				console.error('Failed to create call');
				return;
			}

			isCallActive = true;
			connectionStatus = 'connecting';

			currentCall.on('stream', (stream) => {
				console.log('Received remote stream');
				remoteStream = stream;
				connectionStatus = 'connected';
			});

			currentCall.on('close', () => {
				console.log('Call closed');
				endCall();
			});

			currentCall.on('error', (err) => {
				console.error('Call error:', err);
				connectionStatus = 'disconnected';
			});
		} catch (error) {
			console.error('Error starting call:', error);
			connectionStatus = 'disconnected';
		}
	}

	function endCall() {
		if (currentCall) {
			currentCall.close();
			currentCall = null;
		}

		if (localStream) {
			localStream.getTracks().forEach(track => track.stop());
			localStream = null;
		}

		if (localVideoElement) {
			localVideoElement.srcObject = null;
		}

		if (remoteVideoElement) {
			remoteVideoElement.srcObject = null;
		}

		remoteStream = null;
		isCallActive = false;
		connectionStatus = 'disconnected';
	}

	onDestroy(() => {
		endCall();
		
		if (peer) {
			peer.destroy();
			peer = null;
		}

		if (signalingChannel && !signalingChannel.prop) {
			unsubscribeFromChannel('ChatChannel', { room_id: roomId });
		}
	});

	async function getLocalStream() {
		try {
			const constraints = {
				video: {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					facingMode: 'user'
				},
				audio: {
					echoCancellation: true,
					noiseSuppression: true
				}
			};

			localStream = await navigator.mediaDevices.getUserMedia(constraints);

			// Start with video enabled, audio muted
			if (localStream) {
				const videoTrack = localStream.getVideoTracks()[0];
				const audioTrack = localStream.getAudioTracks()[0];
				
				if (videoTrack) {
					videoTrack.enabled = true;
					isVideoEnabled = true;
				}
				if (audioTrack) {
					audioTrack.enabled = false;
					isAudioEnabled = false;
				}
			}

			// Set video element
			if (localVideoElement && localStream) {
				localVideoElement.srcObject = localStream;
				localVideoElement.play().catch(console.error);
			}

			return localStream;
		} catch (error) {
			console.error('Error accessing media devices:', error);
			
			let errorMessage = 'Could not access camera/microphone. ';
			if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
				errorMessage += 'No camera or microphone found.';
			} else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
				errorMessage += 'Permission denied. Please allow camera and microphone access.';
			} else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
				errorMessage += 'Camera or microphone is already in use.';
			} else {
				errorMessage += 'Please check your device permissions.';
			}
			
			alert(errorMessage);
			throw error;
		}
	}

	function toggleVideo() {
		if (localStream) {
			const videoTrack = localStream.getVideoTracks()[0];
			if (videoTrack) {
				isVideoEnabled = !isVideoEnabled;
				videoTrack.enabled = isVideoEnabled;
			}
		}
	}

	function toggleAudio() {
		if (localStream) {
			const audioTrack = localStream.getAudioTracks()[0];
			if (audioTrack) {
				isAudioEnabled = !isAudioEnabled;
				audioTrack.enabled = isAudioEnabled;
			}
		}
	}
</script>

<div class="video-call-container">
	<!-- Connection Status Indicator -->
	{#if isCallActive || connectionStatus === 'connecting'}
		<div class="connection-status-bar" class:connected={connectionStatus === 'connected'} class:connecting={connectionStatus === 'connecting'} class:disconnected={connectionStatus === 'disconnected'}>
			<div class="status-indicator">
				<div class="status-dot"></div>
				<span class="status-text">
					{#if connectionStatus === 'connected'}
						Connected to video
					{:else if connectionStatus === 'connecting'}
						Connecting...
					{:else}
						Connection lost
					{/if}
				</span>
			</div>
		</div>
	{/if}

	{#if isCallActive}
		<div class="video-call-active">
			<div class="video-grid">
				<div class="remote-video-container">
					<video 
						bind:this={remoteVideoElement} 
						autoplay 
						playsinline 
						class="remote-video"
						on:loadedmetadata={() => {
							if (remoteVideoElement) {
								remoteVideoElement.play().catch(console.error);
							}
						}}
					></video>
					{#if !remoteStream}
						<div class="video-placeholder">Waiting for remote video...</div>
					{/if}
				</div>
				<div class="local-video-container">
					<video 
						bind:this={localVideoElement} 
						autoplay 
						playsinline 
						muted 
						class="local-video"
						on:loadedmetadata={() => {
							if (localVideoElement) {
								localVideoElement.play().catch(console.error);
							}
						}}
					></video>
					{#if !localStream}
						<div class="video-placeholder">Local video not available</div>
					{:else if !isVideoEnabled}
						<div class="video-off-indicator">Video Off</div>
					{/if}
				</div>
			</div>
			<div class="call-controls">
				<button 
					class="control-btn" 
					class:active={isAudioEnabled}
					on:click={toggleAudio}
					title={isAudioEnabled ? 'Mute' : 'Unmute'}
				>
					{isAudioEnabled ? '🔊' : '🔇'}
				</button>
				<button 
					class="control-btn" 
					class:active={isVideoEnabled}
					on:click={toggleVideo}
					title={isVideoEnabled ? 'Turn off video' : 'Turn on video'}
				>
					{isVideoEnabled ? '📹' : '📷'}
				</button>
				<button class="control-btn end-call" on:click={endCall} title="End call">
					📞
				</button>
			</div>
		</div>
	{:else if localStream}
		<div class="video-preview">
			<div class="local-video-preview-container">
				<video bind:this={localVideoElement} autoplay playsinline muted class="local-video-preview"></video>
				{#if !isVideoEnabled}
					<div class="video-off-overlay">
						<div class="video-off-icon">📷</div>
						<p>Camera Off</p>
					</div>
				{/if}
			</div>
			<div class="preview-controls">
				<button 
					class="preview-control-btn" 
					class:active={isVideoEnabled}
					on:click={toggleVideo}
					title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
				>
					{isVideoEnabled ? '📹' : '📷'}
				</button>
				<button 
					class="preview-control-btn" 
					class:active={isAudioEnabled}
					on:click={toggleAudio}
					title={isAudioEnabled ? 'Mute' : 'Unmute'}
				>
					{isAudioEnabled ? '🔊' : '🔇'}
				</button>
				{#if connectionStatus === 'connecting'}
					<div class="calling-status">Connecting...</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="video-preview">
			<div class="local-video-preview-container">
				<div class="video-placeholder">Initializing camera...</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.video-call-container {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: #000;
		border-radius: 8px;
		overflow: hidden;
		position: relative;
	}

	.connection-status-bar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(10px);
		padding: 0.5rem 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		transition: all 0.3s ease;
	}

	.connection-status-bar.connected {
		background: rgba(34, 197, 94, 0.2);
		border-bottom-color: rgba(34, 197, 94, 0.3);
	}

	.connection-status-bar.connecting {
		background: rgba(251, 191, 36, 0.2);
		border-bottom-color: rgba(251, 191, 36, 0.3);
	}

	.connection-status-bar.disconnected {
		background: rgba(239, 68, 68, 0.2);
		border-bottom-color: rgba(239, 68, 68, 0.3);
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: white;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #6b7280;
		transition: all 0.3s ease;
		animation: pulse 2s infinite;
	}

	.connection-status-bar.connected .status-dot {
		background: #22c55e;
		box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
		animation: pulse 2s infinite;
	}

	.connection-status-bar.connecting .status-dot {
		background: #fbbf24;
		box-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
		animation: pulse 1s infinite;
	}

	.connection-status-bar.disconnected .status-dot {
		background: #ef4444;
		box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
		animation: none;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.7;
			transform: scale(1.1);
		}
	}

	.status-text {
		letter-spacing: 0.025em;
	}

	.video-call-active {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 300px;
	}

	@media (max-width: 768px) {
		.video-call-active {
			height: 100%;
			min-height: 0;
		}
	}

	.video-grid {
		flex: 1;
		position: relative;
		display: flex;
		flex-direction: row;
		gap: 2px;
		background: #000;
		padding: 2px;
		width: 100%;
		height: 100%;
	}

	@media (max-width: 768px) {
		.video-grid {
			flex-direction: column;
			height: 100%;
			flex: 1;
		}
	}

	.remote-video-container {
		flex: 1;
		width: 50%;
		height: 100%;
		min-height: 200px;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #1a1a1a;
		border-radius: 4px;
		overflow: hidden;
	}

	@media (max-width: 768px) {
		.remote-video-container {
			width: 100%;
			height: 50%;
			min-height: 0;
			flex: 1;
		}
	}

	.remote-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		background: #000;
	}

	.local-video-container {
		flex: 1;
		width: 50%;
		height: 100%;
		min-height: 200px;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #1a1a1a;
		border-radius: 4px;
		overflow: hidden;
	}

	@media (max-width: 768px) {
		.local-video-container {
			width: 100%;
			height: 50%;
			min-height: 0;
			flex: 1;
		}
	}

	.local-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		background: #000;
	}

	.video-placeholder, .video-off-indicator {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: white;
		font-size: 1rem;
		z-index: 10;
		pointer-events: none;
	}

	.call-controls {
		display: flex;
		justify-content: center;
		gap: 1rem;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.7);
		flex-shrink: 0;
	}

	@media (max-width: 768px) {
		.call-controls {
			padding: 0.75rem;
			padding-bottom: calc(0.75rem + 60px); /* Add space for mobile tabs */
			margin-bottom: 0;
		}
	}

	.control-btn {
		width: 50px;
		height: 50px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.2);
		color: white;
		font-size: 1.5rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.control-btn:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.control-btn.active {
		background: rgba(76, 175, 80, 0.5);
	}

	.control-btn.end-call {
		background: #f44336;
	}

	.control-btn.end-call:hover {
		background: #da190b;
	}

	.video-preview {
		display: flex;
		flex-direction: column;
		height: 100%;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		gap: 1rem;
	}

	.local-video-preview-container {
		position: relative;
		width: 100%;
		max-width: 400px;
		aspect-ratio: 16/9;
		background: #000;
		border-radius: 8px;
		overflow: hidden;
	}

	.local-video-preview {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.video-off-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: white;
	}

	.video-off-icon {
		font-size: 3rem;
		margin-bottom: 0.5rem;
	}

	.video-off-overlay p {
		margin: 0;
		font-size: 1rem;
	}

	.preview-controls {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.preview-control-btn {
		width: 50px;
		height: 50px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.2);
		color: white;
		font-size: 1.5rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.preview-control-btn:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.preview-control-btn.active {
		background: rgba(76, 175, 80, 0.5);
	}

	.calling-status {
		color: white;
		padding: 0.5rem 1rem;
		background: rgba(76, 175, 80, 0.3);
		border-radius: 4px;
		font-size: 0.9rem;
	}
</style>
