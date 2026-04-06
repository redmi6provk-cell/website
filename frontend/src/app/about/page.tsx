import Link from "next/link";
import { ArrowRight, Leaf, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";

const highlights = [
  {
    title: "Daily Essentials",
    description: "Groceries, beverages, snacks aur household items ek jagah se easily order karo.",
    icon: Leaf,
  },
  {
    title: "Trusted Quality",
    description: "Popular brands aur carefully listed products ke saath consistent experience dene par focus hai.",
    icon: ShieldCheck,
  },
  {
    title: "Fast Ordering Flow",
    description: "Simple browsing, quick cart review aur frictionless checkout se shopping smooth rehti hai.",
    icon: Truck,
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f7fee7_0%,_#ffffff_22%,_#ffffff_100%)]">
      <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex rounded-full border border-green-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-green-700">
            About FMCG Store
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-zinc-900 sm:text-5xl">
            Everyday shopping ko simple, fast aur reliable banana hi goal hai.
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-600">
            FMCG Store ek clean digital shopping experience build kar raha hai jahan users essentials
            quickly browse karke apna cart manage kar saken aur bina confusion ke checkout tak pahunch
            saken.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/products">
              <Button className="rounded-full px-6" rightIcon={ArrowRight}>

                
                Explore Products
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="rounded-full px-6">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto grid gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-3 lg:px-8 lg:pb-24">
        {highlights.map(({ title, description, icon: Icon }) => (
          <div
            key={title}
            className="rounded-[1.75rem] border border-zinc-200 bg-white p-8 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.4)]"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-700">
              <Icon className="h-6 w-6" />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-zinc-900">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-600">{description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
