import Link from "next/link";

const footerColumns = [
  {
    title: "Navigation",
    links: [
      { href: "/", label: "Home" },
      { href: "/products", label: "Products" },
      { href: "/about", label: "About" },
      { href: "/about#contact", label: "Contact" },
    ],
  },
  {
    title: "Shopping",
    links: [
      { href: "/products", label: "Browse catalog" },
      { href: "/cart", label: "Cart" },
      { href: "/checkout", label: "Checkout" },
      { href: "/dashboard/orders", label: "My orders" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/dashboard", label: "Profile" },
      { href: "/auth/login", label: "Login" },
      { href: "/about", label: "Store details" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-10">
        <div className="grid gap-12 border-b border-zinc-200 pb-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
          <div className="max-w-md">
            <Link href="/" className="inline-flex items-center gap-3 text-zinc-950 transition-colors duration-200 hover:text-green-700">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-900 text-[11px] font-semibold tracking-[0.32em]">
                FM
              </span>
              <span className="text-base font-semibold tracking-[0.18em] uppercase">FMCG Store</span>
            </Link>

            <p className="mt-6 text-sm leading-7 text-zinc-600">
              Everyday essentials, repeat purchases, and quick ordering flows designed with a simpler and cleaner shopping experience in mind.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-zinc-800"
              >
                Shop Products
              </Link>
              <Link
                href="/about"
                className="inline-flex rounded-full border border-zinc-200 px-5 py-3 text-sm font-medium text-zinc-700 transition-colors duration-200 hover:border-zinc-900 hover:text-zinc-950"
              >
                About Store
              </Link>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-400">
                  {column.title}
                </h3>
                <ul className="mt-5 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm font-medium text-zinc-600 transition-colors duration-200 hover:text-zinc-950"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} FMCG Store</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/about" className="transition-colors duration-200 hover:text-zinc-950">
              About
            </Link>
            <Link href="/products" className="transition-colors duration-200 hover:text-zinc-950">
              Catalog
            </Link>
            <Link href="/about#contact" className="transition-colors duration-200 hover:text-zinc-950">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
