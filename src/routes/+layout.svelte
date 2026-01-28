<script>
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/user';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	$: isAuthenticated = $user !== null;
	$: currentPath = $page.url.pathname;

	// User is now loaded synchronously from localStorage in the store itself
</script>

<nav>
	<div class="nav-content">
		<h1>VidRoom</h1>
		<div class="nav-links">
			{#if isAuthenticated}
				<span class="username">Hello, {$user.username}!</span>
				<button on:click={() => { user.set(null); goto('/'); }}>Sign Out</button>
			{:else}
				<a href="/login">Login</a>
				<a href="/signup">Sign Up</a>
			{/if}
		</div>
	</div>
</nav>

<main>
	<slot />
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
	}

	nav {
		background: #1a1a1a;
		color: white;
		padding: 1rem 2rem;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	.nav-content {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.nav-links {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.nav-links a, .nav-links button {
		color: white;
		text-decoration: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		background: #333;
		border: none;
		cursor: pointer;
		transition: background 0.2s;
	}

	.nav-links a:hover, .nav-links button:hover {
		background: #444;
	}

	.username {
		color: #ccc;
	}

	main {
		min-height: calc(100vh - 60px);
		background: #f5f5f5;
	}
</style>

