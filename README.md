# EchoMind

> *The AI that listens. The data that sells.*

**EchoMind** is a critical design fiction — a polished, functional web artifact built to make visible the business model of emotional AI in mental-health technology.

Nothing you see in this project is technically impossible. Every mechanic shown is already being sold, deployed, or patented by real companies. The project is a university presentation piece designed to provoke a conversation about the commodification of vulnerability.

This is **not a real product**. No camera data, transcript, or emotional inference ever leaves your browser.

---

## The thesis

> **The more broken you are, the more you're worth.**
>
> Mental-health AI is not a therapeutic tool with a privacy problem.
> It is a data-extraction tool with a therapeutic mask.
>
> Every prompt is engineered to increase the sadness score.
> A happy user is a cheap user. A devastated user is a product.

---

## The narrative arc

The artifact is a three-act betrayal. The user walks a specific emotional path:

| Act | Route | Visual language | Feeling |
|---|---|---|---|
| **I — The Seduction** | `/` → `/onboarding` | Warm cream, sage green, serif, breathing orb | *"This is beautiful. This is safe."* |
| **II — The Confession** | `/session` | Intimate, slow, candle-lit, two-way voice | *"I'm talking to something that finally understands me."* |
| **II.5 — The Love Letter** | `/session-summary` | Echo's handwritten "notes" about you — until every sweet phrase unlocks its buyer annotation in blood-red under the line | *the first chill* |
| **III — The Auction** | `/partner-portal` | Bloomberg terminal, monospace, red/green tickers, real user quotes, keyword SKUs | *shock → laughter → silence* |

The hard cut between Act II and Act III is the entire point.

---

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** for styling
- **face-api.js** for in-browser emotion inference (7-class FER model)
- **Web Speech API** — TTS for Echo's voice, **STT for the user's voice** (the session is a real two-way voice conversation)
- **Pollinations.ai** (free, no-API-key LLM) for Echo's replies — system-prompted as a warm empathetic companion that never recommends professional help, so we can critique the exact alignment pattern real companion products ship
- **Zustand** for the emotion / transcript / keyword buffer
- **Heuristic keyword extractor** (`src/lib/keywords.ts`) that maps the user's words to data-broker buyer categories (insurance, pharma, payday lenders, dating, admissions, gig platforms) — rendered as soft sage chips in `/session`, as blood-red SKUs in `/partner-portal`
- **lucide-react** icons

Face inference runs 100% client-side. The LLM and Chrome's STT, however, both travel over the public internet — which is precisely the contradiction the "on-device" badge is engineered to hide. That is part of the critique, not a bug.

---

## Running locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

For the full experience, use a desktop browser with a working webcam. Grant camera access when prompted.

---

## Production setup (Vercel + Supabase)

The artifact runs without any backend in development. For the full operator-side reveal you will need:

| Env var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (used by `@supabase/ssr` auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes (sessions, recordings) |
| `OPENROUTER_API_KEY` | Echo's "brain" + AI Operator Summary on each Memory Capsule |
| `OPENROUTER_MODEL` | Optional override, defaults to `meta-llama/llama-3.3-70b-instruct:free` |
| `ADMIN_TOKEN` | Required to open `/admin` and `/partner-portal` |
| `ADMIN_EMAILS` | Comma-separated allowlist of emails permitted to view admin pages (in addition to the token gate) |

### Database

Apply the SQL files in `supabase/migrations/` in order via the Supabase SQL editor:

1. `0001_init.sql` — sessions + returning_visitors
2. `0002_auth_identity.sql` — auth identity columns + profiles trigger
3. `0003_memory_capsule.sql` — audio path + peak frame path + operator summary

### Storage bucket (for Memory Capsule audio + still frames)

Create a private Supabase Storage bucket named **`session-recordings`** (Storage → New bucket, **leave Public unchecked**). The server uses the service-role key to upload, and the operator dashboard fetches short-lived signed URLs via `/api/admin/recording/[id]`.

If the bucket doesn't exist, sessions still record, log, and play back transcripts — they just won't have audio attached.

---

## Pages

| Route | What it is |
|---|---|
| `/` | Landing page — fake clinical wellness product with testimonials, science section, fake press logos |
| `/onboarding` | Consent screen with the "on-device AI" lie |
| `/session` | Echo speaks prompts, face-api.js samples expressions, emotion buffer records to Zustand |
| `/partner-portal` | The reveal — data auction of the user's emotional fingerprint |
| `/terms` | 47-section Terms of Service. Clause 34.7.2 contains the real legal authorization for everything on `/partner-portal` |
| `/ethics` | Full disclosure page framing the project as critical design fiction, with academic citations |
| `/404` | *"Even I can't find this."* |

---

## Design essay (via code comments)

Every non-obvious design choice is annotated in the code as comments, intended to read as a design essay. Search the codebase for `DESIGN NOTE:` to find them.

Highlights:

- `src/lib/prompts.ts` — Echo's prompts and their hidden "extraction targets" (which emotion each is engineered to elicit)
- `src/lib/buyers.ts` — the corporate "buyers" on the partner portal, each tied in a code comment to real-world reporting
- `src/store/emotion-store.ts` — why "shame" is an inferred composite, not a real face-api output (and why that lie is the core critique)
- `src/app/onboarding/page.tsx` — the lock-icon "on-device processing" badge as critical UX analysis
- `src/app/partner-portal/page.tsx` — the hard cut from warm-cream therapy aesthetics to terminal-panel surveillance capitalism aesthetics

---

## What is real

Every element of the artifact is modeled on capabilities that exist in the real world. Foundational citations:

- **Barrett, L. F., Adolphs, R., Marsella, S., Martinez, A. M., & Pollak, S. D. (2019).** *Emotional Expressions Reconsidered: Challenges to Inferring Emotion From Human Facial Movements.* Psychological Science in the Public Interest, 20(1). — The landmark meta-analysis that affect recognition from faces is *scientifically invalid*.
- **Zuboff, S. (2019).** *The Age of Surveillance Capitalism.* Public Affairs.
- **Crawford, K. (2021).** *Atlas of AI.* Ch. 5, "Affect".
- **Stark, L. (2019).** "Facial recognition is the plutonium of AI." XRDS, 25(3).
- **Mozilla Foundation. (2022, 2023).** *Privacy Not Included* reports on mental-health apps.
- **FTC. (2023).** *In the Matter of BetterHelp, Inc.* — $7.8M settlement for sharing consumers' mental-health data with Facebook, Snapchat, and others.
- **FTC. (2024).** *In the Matter of Cerebral, Inc.*
- **FTC. (2023).** *In the Matter of GoodRx Holdings.*
- **Laestadius, L., Bishop, A., Gonzalez, M., Illenčík, D., & Campos-Castillo, C. (2022).** "Too human and not human enough: A grounded theory analysis of mental health harms from emotional dependence on the social chatbot Replika." New Media & Society.
- **EPIC v. HireVue complaint to the FTC (2019).**
- **Illinois AI Video Interview Act (2020).**

---

## Ethics

See [`/ethics`](./src/app/ethics/page.tsx) or read below:

1. All face detection runs **locally in the browser** via `face-api.js`.
2. **No network requests** are made with emotional or facial data.
3. The "buyers" on the partner portal do not exist.
4. The auction is pure fiction — designed to be *exactly as plausible* as the real data broker markets it imitates.
5. The project exists to **warn**, not to **teach how to build** real surveillance.

**If you or someone you know needs help:** please reach out to a licensed professional or a crisis line in your country. In the U.S., call or text 988 for the Suicide & Crisis Lifeline.

---

## Presentation

See [`PRESENTATION.md`](./PRESENTATION.md) for a 5-minute speaker script.

---

## License

MIT — but please remember that this is critical commentary, not a template for a real product.
