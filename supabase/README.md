# Supabase

Run `migrations/0001_sessions.sql` in the Supabase SQL editor (or with the Supabase CLI) to create the `sessions` table.

Then set on the backend:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

When either is missing, the server falls back to an in-memory store, which is fine for local development. Sessions in the in-memory store are lost on restart.
