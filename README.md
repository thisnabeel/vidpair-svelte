# VidRoom Frontend

SvelteKit frontend for VidRoom pairing and chat application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Update API URL in `src/lib/stores/api.js` and `src/lib/stores/cable.js` if needed (defaults to `http://localhost:3000` for development)

3. Start the development server:
```bash
npm run dev
```

The app will run on `http://localhost:5173`

## Features

- User authentication (login/signup)
- Pairing interface with spinner
- Real-time chat with WebSocket
- Responsive design

## Pages

- `/` - Home page with "Begin Pairing" button
- `/login` - Login page
- `/signup` - Sign up page
- `/chat/[id]` - Chat room page

## Building

To build for production:
```bash
npm run build
```

To preview production build:
```bash
npm run preview
```

# vidpair-svelte
