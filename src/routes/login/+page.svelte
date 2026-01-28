<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/user';
	import api from '$lib/stores/api';
	import { goto } from '$app/navigation';

	let email = '';
	let password = '';
	let error = '';
	let loading = false;

	$: isAuthenticated = $user !== null;

	onMount(() => {
		// Redirect if already logged in
		if ($user) {
			goto('/');
		}
	});

	async function handleLogin() {
		error = '';
		loading = true;

		try {
			const response = await api.post('/users/sign_in', {
				login: email,
				password: password
			});

			if (response.data && response.data.generated_token) {
				user.set(response.data);
				goto('/');
			} else {
				error = 'Invalid credentials';
			}
		} catch (err) {
			error = err.response?.data?.error || 'Login failed. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Login - VidRoom</title>
</svelte:head>

{#if isAuthenticated}
	<!-- Redirecting... -->
{:else}
<div class="container">
	<div class="form-card">
		<h1>Login</h1>
		
		{#if error}
			<div class="error">{error}</div>
		{/if}

		<form on:submit|preventDefault={handleLogin}>
			<div class="form-group">
				<label for="email">Email or Username</label>
				<input
					id="email"
					type="text"
					bind:value={email}
					required
					placeholder="Enter your email or username"
				/>
			</div>

			<div class="form-group">
				<label for="password">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					placeholder="Enter your password"
				/>
			</div>

			<button type="submit" disabled={loading}>
				{loading ? 'Logging in...' : 'Login'}
			</button>
		</form>

		<p class="signup-link">
			Don't have an account? <a href="/signup">Sign up</a>
		</p>
	</div>
</div>
{/if}

<style>
	.container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: calc(100vh - 60px);
		padding: 2rem;
	}

	.form-card {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 2px 10px rgba(0,0,0,0.1);
		width: 100%;
		max-width: 400px;
	}

	h1 {
		text-align: center;
		margin-bottom: 2rem;
		color: #333;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		color: #555;
		font-weight: 500;
	}

	input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		box-sizing: border-box;
	}

	input:focus {
		outline: none;
		border-color: #4CAF50;
	}

	button {
		width: 100%;
		padding: 0.75rem;
		background: #4CAF50;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	button:hover:not(:disabled) {
		background: #45a049;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error {
		background: #ffebee;
		color: #c62828;
		padding: 0.75rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.signup-link {
		text-align: center;
		margin-top: 1.5rem;
		color: #666;
	}

	.signup-link a {
		color: #4CAF50;
		text-decoration: none;
	}

	.signup-link a:hover {
		text-decoration: underline;
	}
</style>

