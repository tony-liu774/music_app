# Supabase Project Setup

## 1. Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com) and create a new project
2. Note your **Project URL** and **anon public key** from Settings > API

## 2. Configure Environment Variables

Copy `client/.env.example` to `client/.env` and fill in:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `https://<your-project-id>.supabase.co/auth/v1/callback`
4. In Supabase Dashboard > Authentication > Providers > Google:
   - Enable the Google provider
   - Enter your Google Client ID and Client Secret

## 4. Configure Apple OAuth

1. Go to [Apple Developer Account](https://developer.apple.com/account/resources/identifiers)
2. Register a new App ID with "Sign In with Apple" capability
3. Create a Services ID for web authentication
4. Add the return URL: `https://<your-project-id>.supabase.co/auth/v1/callback`
5. Generate a private key for Sign In with Apple
6. In Supabase Dashboard > Authentication > Providers > Apple:
   - Enable the Apple provider
   - Enter your Services ID, Team ID, Key ID, and private key

## 5. Auth Settings

In Supabase Dashboard > Authentication > URL Configuration:
- Set **Site URL** to your app's URL (e.g., `http://localhost:5173` for development)
- Add redirect URLs: `http://localhost:5173`, and your production URL

## 6. Verify

After configuration, users should be able to sign in via Google or Apple OAuth buttons on the login page.
