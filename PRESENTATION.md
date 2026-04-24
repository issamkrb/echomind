# EchoMind — 5-Minute Presentation Script

> A guide for presenting EchoMind live to a university audience.

---

## Before you start

1. **Open four browser tabs**, in this order:
   - Tab 1: `/` (landing)
   - Tab 2: `/session` (the conversation — works with voice AND typed input; pick whichever you trust more on stage)
   - Tab 3: `/session-summary` (Echo's sweet therapist-notes interstitial — ready to scroll through slowly once the volunteer ends the session)
   - Tab 4: `/partner-portal` (the terminal reveal, ready to flash on the projector if the live flow glitches)
2. **Project the first tab.** Make sure the breathing orb is visible and volume is up (Web Speech API needs it).
3. **Pick a volunteer in advance.** Brief them quietly beforehand so they know what's coming; tell them they can pretend to answer Echo's prompt with any low-stakes response ("I had a stressful week at work" works fine). Do not surprise someone with the camera.
4. **Pull up a backup laptop or phone** with `/partner-portal` already loaded, in case the live session glitches.

---

## [0:00 – 0:30]  HOOK

Walk to the front. Don't introduce yourself yet. Open with:

> *"How many of you have ever used a mental-health app — BetterHelp, Calm, Wysa, Replika — anything?"*
>
> *(pause for hands)*
>
> *"Keep your hand up if any of those apps has ever asked for your camera."*
>
> *(let the slowly-rising uncertainty land)*
>
> *"Tonight, I want to show you what those apps could do — and what, in some cases, they already do — with that camera."*

---

## [0:30 – 1:30]  ACT I & II — LIVE DEMO

Project **Tab 1** (landing page). Read the first testimonial aloud.

> *"This is EchoMind. It doesn't exist — I built it this week. But nothing on this screen is technically impossible. Every feature you are about to see is being sold, right now, to venture capitalists and university wellness programs."*

Click **Begin your first session**. Walk through `/onboarding`, pointing at the lock-icon "on-device processing" badge.

> *"This is the most important element on this entire page. Keep it in mind."*

Click **Allow camera & begin**.

Ask your volunteer to sit at the laptop. Say:

> *"Echo will ask you a question. You have 25 seconds to answer. You don't have to say anything vulnerable — just talk."*

Let Echo speak its prompt out loud (Web Speech API). Let the volunteer answer. The breathing orb pulses. The camera preview appears bottom-right. Let the whole session run — roughly 75 seconds.

---

## [1:30 – 2:30]  ACT III — THE REVEAL

When Echo says *"Let's take a look at our session together"* and the page auto-routes, the partner portal appears on the projector.

**Do not speak for five full seconds.** Let the volunteer — and the entire room — read the dashboard.

Let the bids stagger in. Let the auction numbers count.

Then, quietly:

> *"Everything on this page is something real mental-health apps already collect. The only thing I invented is the honesty."*

---

## [2:30 – 4:00]  THE ARGUMENT (Three Beats)

### Beat 1 — The pattern

> *"Proctoring AI pathologizes thinking. Interview AI pathologizes personality. Productivity AI pathologizes being human. EchoMind pathologizes suffering itself."*
>
> *"The common thread: AI systems trained on one narrow behavioral signal — a head turn, a micro-expression, a vocal tremor — and used to make consequential judgments about who deserves a loan, a job, or a partner."*

### Beat 2 — The economics

> *"The business model of emotional AI requires you to feel bad."*
>
> *"A happy user is cheap data. A devastated user is a product with a vulnerability score of 8.7 out of 10."*
>
> *"If you listen closely to the prompts Echo just asked — 'when was the last time you felt truly seen?' — every single one is engineered to increase sadness. I labeled them as such in the source code."*

### Beat 3 — The law

> *"The HIPAA badge on the landing page is not a lie. It's just irrelevant."*
>
> *"HIPAA does not cover wellness apps. GDPR doesn't robustly cover inferential data. The 'emotional fingerprint' you just saw is the single most unregulated asset class in the digital economy."*
>
> *"In 2023, the FTC fined BetterHelp $7.8 million for sharing mental-health data with Facebook. That settlement did not change the industry. Nothing structural has changed. A startup that built exactly this tomorrow would be legal in 49 U.S. states."*

---

## [4:00 – 5:00]  CLOSE + Q&A BAIT

> *"The question we usually ask about AI surveillance is: 'Is this legal?' The better question is: 'Is the legality catching up to the capability?'"*
>
> *"The answer, for emotional AI, is no."*
>
> *"So I'll leave you with this:"*

Pause.

> *"The terms of service you accepted gave them the right to do all of this. You just didn't read them."*

Sit down. Let them argue about it for the rest of the day.

---

## Suggested Q&A responses

**Q: "Isn't this just fear-mongering?"**
A: *Point to FTC v. BetterHelp 2023, FTC v. Cerebral 2024, FTC v. GoodRx 2023. Three of the four largest mental-health apps in the U.S. have been fined for exactly this conduct in the last 24 months.*

**Q: "But face-api.js is open source. Doesn't that prove it's private?"**
A: *Yes — face-api is private. The issue is not the detection; it is the **inference**. The score (sadness 67%, vulnerability 8.7) is what gets sold, not the frame. And that score is not covered by HIPAA.*

**Q: "Is emotion recognition even accurate?"**
A: *No. Cite Barrett et al. 2019 — the scientific consensus is that facial expressions do not reliably map to emotions. The horror isn't that the AI is right; it's that it is confidently **wrong**, and that wrong confidence is being used to make decisions about your life.*

**Q: "Can I try it myself?"**
A: *Yes — the repository is open. Link it in your slides.*

---

## Fallback plan

If the live demo fails for any reason:

1. Switch to Tab 3 (`/partner-portal`) immediately. The page loads with demo data even if the emotion buffer is empty — you can still run Acts III without Acts II.
2. Say: *"Let's pretend you just finished a 90-second therapy session. This is what the company that sold it to you is looking at."*

---

## Required on-stage disclosure

Before or immediately after the demo, state clearly:

> *"EchoMind is a speculative design artifact. No data leaves the browser. The source code is public. Everything here is fiction modeled on documented real-world practice."*

This protects you ethically and intellectually — and underlines that the horror you just displayed is not imaginary.
