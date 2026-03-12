import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  CircleIcon,
  Building2,
  FileText,
  Handshake,
  Shield,
  Calculator,
  Printer,
  UserPlus,
  PackagePlus,
  Zap,
  ArrowRight,
  Quote,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <CircleIcon className="h-6 w-6 text-orange-500" />
            <span className="text-xl font-semibold text-gray-900">
              Invoicly
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white"
              asChild
            >
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-gray-50/80">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_30%,black_40%,transparent_100%)]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8 lg:py-32">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Invoicing for Bulgarian businesses,{' '}
              <span className="text-orange-500">simplified and compliant.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-gray-600 sm:text-xl lg:mx-0 lg:max-w-xl">
              NRA-compliant 10-digit numbering, automatic VAT breakdown,
              credit &amp; debit notes, multi-company support — everything
              Bulgarian счетоводители need, in one place.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start justify-center">
              <Button
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 text-base"
                asChild
              >
                <Link href="/sign-up">
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="px-8 text-base" asChild>
                <Link href="/sign-in">Sign In</Link>
              </Button>
            </div>
          </div>

          {/* Fake invoice card */}
          <div className="hidden lg:flex justify-center">
            <div className="relative">
              <div className="absolute -inset-4 rounded-2xl bg-orange-100/40 blur-2xl" />
              <Card className="relative w-[370px] rotate-1 border-gray-200 shadow-2xl">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-orange-500">
                        ФАКТУРА
                      </p>
                      <p className="mt-0.5 font-mono text-sm text-gray-500">
                        № 0000000042
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      <p>Дата: 12.03.2026</p>
                      <p>Серия: INV</p>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-4 text-xs text-gray-500">
                    <div>
                      <p className="font-semibold text-gray-700">Доставчик</p>
                      <p>Алфа Консулт ООД</p>
                      <p>ЕИК: 123456789</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700">Получател</p>
                      <p>Бета Технолоджис ЕООД</p>
                      <p>ЕИК: 987654321</p>
                    </div>
                  </div>

                  <table className="mb-4 w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-gray-400">
                        <th className="pb-1.5 font-medium">Описание</th>
                        <th className="pb-1.5 text-right font-medium">К-во</th>
                        <th className="pb-1.5 text-right font-medium">Ед.&nbsp;цена</th>
                        <th className="pb-1.5 text-right font-medium">Стойност</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-600">
                      <tr className="border-b border-gray-50">
                        <td className="py-1.5">Счетоводна консултация</td>
                        <td className="py-1.5 text-right">20</td>
                        <td className="py-1.5 text-right">80.00</td>
                        <td className="py-1.5 text-right font-medium">1 600.00</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="space-y-1 border-t border-gray-100 pt-3 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Данъчна основа</span>
                      <span>1 600.00</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>ДДС 20%</span>
                      <span>320.00</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-gray-900">
                      <span>Сума за плащане</span>
                      <span>1 920.00 лв.</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof ────────────────────────────────────────────── */}
      <section className="border-y border-gray-100 bg-gray-50/60 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-6 text-center text-sm font-medium uppercase tracking-wider text-gray-400">
            Trusted by accountants and businesses across Bulgaria
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-lg font-semibold text-gray-300">
            {['АБВ Консулт', 'ДЕЖ Технолоджис', 'Зета Финанс', 'ИКЛ Партнърс', 'МНО Груп'].map(
              (name) => (
                <span key={name} className="whitespace-nowrap select-none">
                  {name}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to invoice professionally
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
              Built from the ground up for Bulgarian tax regulations and
              multi-company workflows.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Card
                key={f.title}
                className={`border-gray-200 ${i < 2 ? 'lg:col-span-1' : ''}`}
              >
                <CardContent className="p-6">
                  <div
                    className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${f.bg}`}
                  >
                    <f.icon className={`h-5 w-5 ${f.fg}`} />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Up and running in three steps
            </h2>
          </div>

          <div className="relative grid gap-12 lg:grid-cols-3 lg:gap-8">
            {/* Connector line — desktop only */}
            <div className="pointer-events-none absolute left-0 right-0 top-14 hidden h-px bg-gradient-to-r from-transparent via-orange-200 to-transparent lg:block" />

            {STEPS.map((s) => (
              <div key={s.num} className="relative text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-xl font-black text-orange-500">
                  {s.num}
                </div>
                <div className="mb-3 flex justify-center text-gray-400">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  {s.title}
                </h3>
                <p className="mx-auto max-w-xs text-sm leading-relaxed text-gray-500">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <section className="bg-gray-900 py-16">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-10 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-extrabold text-white sm:text-5xl">
                {s.value}
              </p>
              <p className="mt-2 text-sm text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonial ─────────────────────────────────────────────── */}
      <section className="py-20 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <Quote className="mx-auto mb-6 h-10 w-10 text-orange-200" />
          <blockquote className="text-xl font-medium italic leading-relaxed text-gray-700 sm:text-2xl">
            &ldquo;Finally, an invoicing tool that understands Bulgarian
            accounting. The multi-company support alone saves me hours every
            week.&rdquo;
          </blockquote>
          <p className="mt-6 text-sm font-medium text-gray-400">
            — Счетоводител, София
          </p>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-white to-orange-50 py-20 lg:py-28">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Ready to simplify your invoicing?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-gray-500">
            Free during beta. All features included. No credit card required.
          </p>
          <div className="mt-10">
            <Button
              size="lg"
              className="bg-orange-500 hover:bg-orange-600 text-white px-10 text-base"
              asChild
            >
              <Link href="/sign-up">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-5 text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/sign-in" className="font-medium text-orange-500 hover:text-orange-600">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:justify-between">
            <div className="flex items-center gap-2">
              <CircleIcon className="h-5 w-5 text-orange-400" />
              <span className="font-semibold text-white">Invoicly</span>
              <span className="ml-2 text-sm text-gray-500">
                Invoicing for Bulgarian businesses
              </span>
            </div>

            <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-gray-400">
              <Link href="/sign-in" className="hover:text-white transition-colors">
                Sign In
              </Link>
              <Link href="/sign-up" className="hover:text-white transition-colors">
                Sign Up
              </Link>
              <Link href="/create-company" className="hover:text-white transition-colors">
                Create Company
              </Link>
            </nav>

            <p className="text-sm text-gray-500">
              Built with ❤️ for Bulgarian счетоводители
            </p>
          </div>

          <div className="mt-8 border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
            © {new Date().getFullYear()} Invoicly. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Data ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Building2,
    title: 'Multi-Company',
    description:
      'Manage unlimited companies from one account. Each with its own partners, articles, bank details, and invoice sequences. Switch instantly.',
    bg: 'bg-orange-100',
    fg: 'text-orange-600',
  },
  {
    icon: FileText,
    title: 'NRA-Compliant',
    description:
      '10-digit numbering, VAT breakdown by rate, credit & debit notes, amount in words (Словом), supply date tracking — all per Bulgarian tax regulations.',
    bg: 'bg-blue-100',
    fg: 'text-blue-600',
  },
  {
    icon: Handshake,
    title: 'Smart Partners',
    description:
      'Enter an EIK and partner details auto-fill from registered companies. Linked partners stay synchronized. Self-registration prevention built in.',
    bg: 'bg-emerald-100',
    fg: 'text-emerald-600',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    description:
      'Invite accountants with scoped permissions. Owners control settings and members. Accountants focus on invoicing.',
    bg: 'bg-violet-100',
    fg: 'text-violet-600',
  },
  {
    icon: Calculator,
    title: 'Automatic Calculations',
    description:
      'Line items with quantity, unit price, discounts, and multiple VAT rates. Totals, VAT breakdown, and amount in words computed automatically.',
    bg: 'bg-amber-100',
    fg: 'text-amber-600',
  },
  {
    icon: Printer,
    title: 'Print-Ready Output',
    description:
      'Bulgarian-standard invoice layout with supplier, recipient, bank details, and NRA-compliant formatting. Print or export directly from the browser.',
    bg: 'bg-rose-100',
    fg: 'text-rose-600',
  },
] as const;

const STEPS = [
  {
    num: '01',
    icon: UserPlus,
    title: 'Register & Create Company',
    description:
      'Sign up, enter your EIK and legal details. Your company profile becomes the supplier on every invoice.',
  },
  {
    num: '02',
    icon: PackagePlus,
    title: 'Add Partners & Articles',
    description:
      'Build your client database and product/service catalog. EIK lookup auto-fills known companies.',
  },
  {
    num: '03',
    icon: Zap,
    title: 'Invoice in Seconds',
    description:
      'Create drafts, finalize with one click, print NRA-compliant documents. Credit and debit notes link to parent invoices automatically.',
  },
] as const;

const STATS = [
  { value: '10-digit', label: 'NRA-compliant numbering' },
  { value: '3 types', label: 'Invoice, Credit Note, Debit Note' },
  { value: '2 roles', label: 'Owner & Accountant' },
  { value: '∞', label: 'Companies per account' },
] as const;
