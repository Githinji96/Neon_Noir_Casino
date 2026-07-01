# Neon Noir Casino — Integration API Reference

For third-party integrators embedding this casino into an external app (e.g. sportsbook).

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Database | Supabase (PostgreSQL + PostgREST) |
| Auth | Supabase Auth (JWT) |
| Edge Functions | Deno on Supabase |
| Payments | M-Pesa Daraja API |
| Real-time | Supabase Realtime (WebSocket) |

---

## Required Credentials

Request these from the casino owner:

| Variable | Use |
|----------|-----|
| `SUPABASE_URL` | Base URL for all API calls |
| `SUPABASE_ANON_KEY` | Client-side requests |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only — never expose to client |

---

## Authentication

### Sign In
```http
POST {SUPABASE_URL}/auth/v1/token?grant_type=password
apikey: {SUPABASE_ANON_KEY}
Content-Type: application/json

{ "email": "player@example.com", "password": "secret" }
```
Response includes `access_token` — use as `Bearer` token in all subsequent requests.

### Sign Up
```http
POST {SUPABASE_URL}/auth/v1/signup
apikey: {SUPABASE_ANON_KEY}
Content-Type: application/json

{ "email": "player@example.com", "password": "secret", "data": { "username": "Player99" } }
```

---

## Edge Functions

Base URL: `{SUPABASE_URL}/functions/v1`

All requests require:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### POST /mpesa-stk — Initiate Deposit

```json
Request:  { "phone": "254712345678", "amount": 500, "userId": "uuid" }
Response: { "checkoutRequestId": "ws_CO_XXX", "message": "STK push sent" }
```

- `phone` format: `2547XXXXXXXX` (Kenyan Safaricom only)
- `amount` min: 10 KES, max: 150,000 KES

### POST /mpesa-stk — Query Payment Status

```json
Request:  { "action": "query", "checkoutRequestId": "ws_CO_XXX" }
Response: { "status": "success" | "pending" | "failed" | "already_credited" }
```

Use after 30s if callback has not fired. On `success`, `profiles.balance` is already updated.

---

## Database (PostgREST)

Base URL: `{SUPABASE_URL}/rest/v1`

All requests require:
```
apikey: {SUPABASE_ANON_KEY}
Authorization: Bearer {access_token}
```

### GET /profiles — User Balance

```http
GET /rest/v1/profiles?id=eq.{userId}&select=id,username,balance,phone
```
```json
[{ "id": "uuid", "username": "Player99", "balance": 1250.00, "phone": "254712345678" }]
```

### PATCH /profiles — Update Balance (server-side only)

```http
PATCH /rest/v1/profiles?id=eq.{userId}
Authorization: Bearer {SERVICE_ROLE_KEY}

{ "balance": 1500.00 }
```

### GET /transactions — Deposit History

```http
GET /rest/v1/transactions?user_id=eq.{userId}&order=created_at.desc&limit=20
```
```json
[{ "id": "uuid", "amount": 500, "status": "success", "mpesa_receipt": "PGJ9XXX", "created_at": "..." }]
```

### GET /transactions — Poll Payment Status

```http
GET /rest/v1/transactions?checkout_request_id=eq.{checkoutRequestId}&select=status
```

### GET /jackpots — Live Jackpot Pools

```http
GET /rest/v1/jackpots?select=id,name,type,current_amount,trigger_probability
```
```json
[{ "id": "mega-moolah-noir", "name": "Mega Moolah Noir", "type": "mega", "current_amount": 3429102.55 }]
```

### GET /jackpot_wins — Winner History

```http
GET /rest/v1/jackpot_wins?order=created_at.desc&limit=10&select=id,amount,jackpot_id,created_at
```

### GET /vip_users — Player VIP Status

```http
GET /rest/v1/vip_users?user_id=eq.{userId}&select=level,total_points,monthly_points,cashback_available
```
```json
[{ "level": "gold", "total_points": 7250, "cashback_available": 45.50 }]
```

### GET /live_tables — Table Status

```http
GET /rest/v1/live_tables?select=id,name,game_type,status,occupied,seats,min_bet,max_bet
```

### GET /live_table_sessions — Active Players at a Table

```http
GET /rest/v1/live_table_sessions?table_id=eq.{tableId}&select=user_id,username,joined_at
```

### GET /spins — Spin History (analytics)

```http
GET /rest/v1/spins?user_id=eq.{userId}&order=created_at.desc&limit=50&select=game_id,bet,payout,created_at
```

---

## Real-time Subscriptions

### Balance Updates
```js
supabase.channel('balance')
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'profiles',
    filter: `id=eq.${userId}`
  }, (payload) => {
    const newBalance = payload.new.balance;
  })
  .subscribe();
```

### Jackpot Pool Growth
```js
supabase.channel('jackpots')
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'jackpots'
  }, (payload) => {
    const pool = payload.new.current_amount;
  })
  .subscribe();
```

### Jackpot Win Broadcast
```js
supabase.channel('jackpot-wins')
  .on('broadcast', { event: 'jackpot_win' }, ({ payload }) => {
    // { jackpotId, jackpotName, amount, winnerUsername, timestamp }
  })
  .subscribe();
```

---

## Sportsbook Integration Guide

### 1. Shared Authentication
Both apps must use the same Supabase project. Pass the sportsbook user's JWT when loading the casino iframe or redirect.

```js
// In sportsbook — get session token
const { data: { session } } = await supabase.auth.getSession();
const casinoUrl = `https://casino.example.com?token=${session.access_token}`;
```

```js
// In casino app — restore session from URL param
const token = new URLSearchParams(window.location.search).get('token');
if (token) await supabase.auth.setSession({ access_token: token, refresh_token: '' });
```

### 2. Shared Balance
Read/write `profiles.balance` using the service role key on your server. This ensures one wallet across both apps.

### 3. Deep Link to Games
Navigate directly to a specific game:
```
https://casino.example.com/slot
State: { id: "cyber-strike-777", title: "Cyber Strike 777" }
```

Available game IDs:
| ID | Name |
|----|------|
| `cyber-strike-777` | Cyber Strike 777 |
| `neon-jungle-fruits` | Neon Jungle Fruits |
| `dark-matter-reels` | Dark Matter Reels |
| `quantum-vault` | Quantum Vault |
| `neon-samurai` | Neon Samurai |
| `electric-storm` | Electric Storm |

### 4. Deposit Flow
```
User clicks Deposit in sportsbook
  → POST /functions/v1/mpesa-stk
  → Poll GET /rest/v1/transactions every 5s
  → On status=success: balance in profiles.balance is updated
  → Sync balance to sportsbook wallet
```

### 5. VIP Points Sync
VIP points are awarded automatically on every spin. To read a user's VIP status for display in the sportsbook:
```http
GET /rest/v1/vip_users?user_id=eq.{userId}&select=level,total_points
```

---

## Database Schema Summary

```sql
profiles          (id, username, balance, phone, updated_at)
transactions      (id, user_id, phone, amount, status, checkout_request_id, mpesa_receipt)
spins             (id, user_id, game_id, bet, payout, is_free_spin, created_at)
jackpots          (id, name, type, current_amount, base_amount, contribution_rate, trigger_probability)
jackpot_wins      (id, user_id, jackpot_id, amount, created_at)
vip_users         (user_id, level, total_points, monthly_points, cashback_available, last_updated)
vip_transactions  (id, user_id, points_earned, source, created_at)
vip_benefits_log  (id, user_id, benefit_type, amount, timestamp)
live_tables       (id, name, game_type, status, occupied, seats, min_bet, max_bet)
live_table_sessions (id, table_id, user_id, username, joined_at)
leaderboard       (id, user_id, username, win_amount, game_title, created_at)
admin_game_config (id, game_id, enabled, min_bet, max_bet, volatility)
```

---

## Error Codes

| HTTP | Meaning |
|------|---------|
| 400 | Invalid request (bad phone, amount too low, etc.) |
| 401 | Missing or expired JWT |
| 403 | Insufficient permissions (RLS violation) |
| 404 | Resource not found |
| 500 | Edge function error (check Supabase logs) |

---

## Support

Contact the casino owner for:
- Supabase project credentials
- M-Pesa sandbox/production keys
- Admin panel access (`/admin`)
