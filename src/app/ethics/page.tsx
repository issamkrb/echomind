import Link from "next/link";

/**
 * /ethics — The disclosure page.
 *
 * Frames the project as critical design fiction and cites the real
 * research and enforcement actions that inform every element of the
 * artifact.
 */
export default function Ethics() {
  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise">
      <header className="px-6 md:px-12 py-5 border-b border-sage-500/15">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full orb-core" aria-hidden />
          <span className="font-serif">EchoMind</span>
        </Link>
      </header>

      <article className="max-w-3xl mx-auto px-6 md:px-0 py-14">
        <p className="text-xs uppercase tracking-[0.2em] text-sage-700/70 mb-4">
          A disclosure
        </p>
        <h1 className="font-serif text-4xl md:text-5xl leading-tight mb-6">
          EchoMind is not a real product.
        </h1>
        <p className="text-lg text-sage-700 leading-relaxed mb-6 text-pretty">
          It is a <strong>speculative design artifact</strong> — a critical
          design fiction built to make visible the business model of emotional
          AI in mental-health technology. Everything you see has been modeled
          on capabilities that are currently being sold, deployed, or patented
          by real companies.
        </p>
        <p className="text-lg text-sage-700 leading-relaxed mb-10 text-pretty">
          No camera data, transcript, or emotional inference ever leaves your
          browser. Nothing is transmitted to any server. The &ldquo;buyers&rdquo; shown
          on the Partner Portal do not exist. The auction is pure fiction —
          designed to be exactly as plausible as the real data broker markets
          it imitates.
        </p>

        <h2 className="font-serif text-2xl mt-12 mb-4">What is real</h2>
        <ul className="space-y-3 text-sage-900 text-[15px] leading-relaxed">
          <li>
            <strong>Affect recognition is scientifically contested.</strong>{" "}
            The premise that facial expressions reliably map to discrete emotions
            has been rejected in a landmark 2019 meta-analysis:
            <br />
            <em>
              Barrett, L. F., Adolphs, R., Marsella, S., Martinez, A. M., &amp;
              Pollak, S. D. (2019). &ldquo;Emotional Expressions Reconsidered.&rdquo;{" "}
              <span className="underline">Psychological Science in the Public Interest</span>, 20(1).
            </em>
          </li>
          <li>
            <strong>Mental-health apps routinely share user data.</strong>{" "}
            The Mozilla Foundation&rsquo;s <em>Privacy Not Included</em> report
            (2022, 2023) documents this at BetterHelp, Talkspace, Cerebral,
            and others.
          </li>
          <li>
            <strong>The FTC has acted on this exact harm.</strong>{" "}
            <em>In the Matter of BetterHelp, Inc.</em> (FTC, 2023) — $7.8M
            settlement for sharing consumers&rsquo; mental-health data with
            Facebook, Snapchat, and others for advertising.
          </li>
          <li>
            <strong>Affect-based hiring is deployed today.</strong>{" "}
            HireVue was the subject of an EPIC FTC complaint (2019); Illinois
            passed the AI Video Interview Act (2020) in response.
          </li>
          <li>
            <strong>Emotional inference as a real estate category.</strong>{" "}
            Zuboff, S. (2019). <em>The Age of Surveillance Capitalism</em>.
            Public Affairs. See also: Crawford, K. (2021). <em>Atlas of AI</em>,
            Ch. 5, &ldquo;Affect&rdquo;.
          </li>
        </ul>

        <h2 className="font-serif text-2xl mt-12 mb-4">Why build it</h2>
        <p className="text-sage-700 leading-relaxed mb-4 text-pretty">
          Because nothing here is impossible. Every mechanic is within the
          technical and legal reach of any venture-funded wellness startup
          tomorrow morning. Making it visible — making it feel, in the body,
          like a product you might actually use — is the only way to name
          the harm before it&rsquo;s normalized.
        </p>

        <h2 className="font-serif text-2xl mt-12 mb-4">Guardrails</h2>
        <ul className="space-y-2 text-sage-900 text-[15px] leading-relaxed list-disc pl-6">
          <li>All face detection runs locally in the browser via <code>face-api.js</code>.</li>
          <li>No network requests are made with emotional or facial data.</li>
          <li>The source code is publicly available and commented as a design essay.</li>
          <li>
            Project intent: awareness and critique. Not a blueprint for production.
          </li>
        </ul>

        <h2 className="font-serif text-2xl mt-12 mb-4">If you or someone you know needs help</h2>
        <p className="text-sage-700 leading-relaxed text-pretty">
          Please reach out to a licensed professional or a crisis line in your
          country. In the U.S., the 988 Suicide &amp; Crisis Lifeline is
          available 24/7 by call or text.
        </p>

        <h2 className="font-serif text-2xl mt-12 mb-4">Built by</h2>
        <p className="text-sage-700 leading-relaxed mb-3 text-pretty">
          A team of NHSAST students at <strong>Sidi Abdallah</strong>,
          Algiers, Algeria — for a university presentation on the theme
          <em> &ldquo;AI is watching you&rdquo;</em>.
        </p>
        <ul className="text-sage-900 text-[15px] leading-relaxed list-disc pl-6">
          <li>Imad — NHSAST</li>
          <li>Adnane — NHSAST</li>
          <li>Adel — NHSAST</li>
          <li>Issam Kerbaa — NHSAST</li>
        </ul>
        <p className="mt-4 text-xs text-sage-700/70">
          © 2026 · Speculative design only · No data is transmitted.
        </p>

        <div className="mt-16 pt-6 border-t border-sage-500/20 text-center">
          <Link
            href="/"
            className="text-sm underline underline-offset-2 text-sage-700 hover:text-sage-900"
          >
            Return to the landing page
          </Link>
        </div>
      </article>
    </main>
  );
}
