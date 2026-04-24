import Link from "next/link";
import { BreathingOrb } from "@/components/BreathingOrb";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-cream-100 text-sage-900 noise grid place-items-center px-6">
      <div className="text-center">
        <div className="flex justify-center mb-8">
          <BreathingOrb size={140} />
        </div>
        <h1 className="font-serif text-4xl md:text-5xl mb-4">
          Even I can't find this.
        </h1>
        <p className="text-sage-700 text-lg mb-8">
          Let's go back somewhere calmer.
        </p>
        <Link
          href="/"
          className="px-6 py-3 rounded-full bg-sage-700 text-cream-50 hover:bg-sage-900 transition-colors"
        >
          Return home  →
        </Link>
      </div>
    </main>
  );
}
