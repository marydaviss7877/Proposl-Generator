# Upwork API Onboarding Guide

**Purpose:** Get an approved Upwork API key so our system can fetch job postings via Upwork's GraphQL API.

---

## 1. What we're requesting

Access to Upwork's GraphQL API (`https://api.upwork.com/graphql`) so we can query **job postings** (search/read only) and bring them into our own system.

We are **not** requesting the ability to submit proposals, spend Connects, or auto-apply to jobs — Upwork does not allow that via the API, and we don't need it.

---

## 2. Who needs to do what

| Step | Owner | What happens |
|---|---|---|
| 1 | Account owner (client/agency) | Log in to the Upwork account that will "own" the integration |
| 2 | Account owner or dev | Register an application in Upwork's Developer Portal |
| 3 | Account owner or dev | Submit an API key request via the API Center |
| 4 | Upwork | Reviews and approves/rejects (usually within ~2 weeks) |
| 5 | Dev | Implements OAuth 2.0 login flow and starts querying jobs |

---

## 3. Step-by-step

### Step 1 — Register the application
- Go to the Upwork Developer portal and create a new app.
- This gives you a `client_id` and `client_secret`. Keep these secret (never commit to a public repo).
- Set a **redirect/callback URL** — this is the URL Upwork sends users back to after they authorize the app (e.g. `https://yourapp.com/auth/upwork/callback`).

### Step 2 — Request the API key
Submit the request through Upwork's API Center. You'll be asked for:
- **What the app does** — a short, honest description. Suggested wording:
  > "Internal tool to search and import Upwork job postings into our own system so our team can review and prepare proposals more efficiently. Read-only use of job search data."
- **Requester type** — client, agency owner, or developer acting on behalf of a client (pick whichever applies).
- **Environment** — pre-production (testing) or production. Usually start with pre-production, then request production once it works.
- **Audience** — is this for internal use only, or will it be exposed to third parties? (For us: internal use.)
- **If requesting on behalf of someone else** — provide that account's email.
- Agree to keep request volume reasonable (don't imply bulk scraping/high-frequency polling).

### Step 3 — Select scopes
When choosing scopes/permissions for the key, select:
- **Common Entities – Read-Only Access** (required in effectively all cases)
- The **Jobs / Marketplace** scope group (read-only)

Do not request write/proposal-submission scopes — Upwork doesn't offer them for jobs anyway, and requesting more than you need can slow down approval.

### Step 4 — Wait for approval
- Upwork typically responds within **~2 weeks**.
- Most rejections happen because of **incomplete account info** or a vague/mismatched description of intended use — so keep the description above accurate and specific.

### Step 5 — Implement OAuth 2.0
Once approved:
- Use the **OAuth 2.0 Authorization Code Grant** flow (standard, RFC 6749).
- A real Upwork user (the account from Step 1) logs in and authorizes the app once.
- Your backend exchanges the authorization code for an access token + refresh token, and uses that token on all API calls.

### Step 6 — Query jobs
Use the GraphQL query `marketplaceJobPostingsSearch` (the older `marketplaceJobPostings` query is deprecated and will be removed — don't build against it).

Example shape of the request:
```graphql
query {
  marketplaceJobPostingsSearch(
    marketPlaceJobFilter: { ... }   # keywords, skills, budget, category, etc.
    searchType: USER_JOBS_SEARCH
    sortAttributes: { ... }
  ) {
    totalCount
    edges {
      node {
        # job fields
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```
Use `pageInfo`/cursor to paginate through results.

---

## 4. Limits to plan around

- **Rate limits:** ~300 requests/minute per IP, ~40,000 requests/day (exceeding returns HTTP 429 — build in backoff/retry).
- **Read-only:** No proposal submission, no Connects usage, no auto-apply via API — by design, to prevent bid spam.
- **Scope of results:** Job search results are tied to what the authorizing account is entitled to see — this isn't an open firehose of every job on the platform.

---

## 5. What to send Upwork (summary email)

> Subject: API Key Request — Job Search Integration (Read-Only)
>
> We'd like to request API access to Upwork's GraphQL API for our application [app name]. Our use case is read-only: searching and importing job postings into our internal system so our team can review opportunities and prepare proposals more efficiently. We are not requesting proposal-submission or write access. Please let us know if you need anything further to process this request — happy to provide account verification or additional detail.

---

## 6. Open items for our side before submitting

- [ ] Confirm which Upwork account (client/agency) will own the integration
- [ ] Decide pre-production vs. production for the first request
- [ ] Set up the OAuth redirect URL and where `client_id`/`client_secret` will be stored securely
- [ ] Confirm internal-only usage (vs. exposing to third parties) — affects scope selection
