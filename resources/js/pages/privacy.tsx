import { Head, Link } from '@inertiajs/react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

/**
 * Privacy notice, required of a personal information controller under the
 * Data Privacy Act of 2012 (RA 10173).
 *
 * Everything listed under "What we collect" is taken from the columns the
 * app actually writes — users, user_addresses, orders, customer_reports and
 * audit_logs — so the notice describes this system rather than a generic one.
 * Keep it in step when those tables change.
 *
 * The placeholders in CONTACT and RETENTION are business decisions, not
 * engineering ones. They must be filled in before this is relied upon.
 */

const LAST_UPDATED = '1 October 2026';

interface SectionProps {
    title: string;
    children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
    return (
        <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
            <div className="space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{children}</div>
        </section>
    );
}

export default function Privacy() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900">
            <Head title="Privacy Notice - Mejeck IcePlant" />

            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-cyan-300 hover:underline mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to home
                </Link>

                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/30 p-6 sm:p-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-11 h-11 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Privacy Notice</h1>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: {LAST_UPDATED}</p>

                    <Section title="Who is responsible for your information">
                        <p>
                            Mejeck IcePlant is the personal information controller for the data described here. We
                            collect it through this website so that we can sell and deliver ice and beverages to you.
                        </p>
                        <p>
                            This notice is given under the Data Privacy Act of 2012 (Republic Act No. 10173) and its
                            Implementing Rules and Regulations.
                        </p>
                    </Section>

                    <Section title="What we collect, and why">
                        <p>We only collect what an order actually needs. Nothing here is optional padding.</p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                <strong>Your name, username, email address and mobile number</strong> — to create your
                                account, to sign you in, to confirm your email with a one-time code, and so the rider
                                or the store can reach you about an order.
                            </li>
                            <li>
                                <strong>Your date of birth</strong> — to apply age limits that the law places on
                                alcoholic drinks. It is recorded once and is not used for anything else.
                            </li>
                            <li>
                                <strong>Your delivery address, including the map location you pin</strong> — house
                                number, street, purok, barangay, town, province, postal code, landmark and the
                                latitude and longitude — so the rider can find you.
                            </li>
                            <li>
                                <strong>Your orders</strong> — what you bought, when, how much it cost, how you paid,
                                and the delivery details attached to it.
                            </li>
                            <li>
                                <strong>Screenshots of payment you upload</strong> — to confirm a GCash or
                                cash-on-delivery payment before the order is released.
                            </li>
                            <li>
                                <strong>Reports you file, including photos or video you attach</strong> — to look into
                                a complaint about an order or a delivery.
                            </li>
                            <li>
                                <strong>Your IP address and a record of changes made in the system</strong> — kept in
                                an audit log so that a mistake or a dispute can be traced.
                            </li>
                        </ul>
                        <p>
                            Your password is never stored as you typed it. It is kept only as a one-way hash, which
                            cannot be turned back into your password by us or by anyone else.
                        </p>
                    </Section>

                    <Section title="Why we are allowed to hold it">
                        <p>
                            For most of the above, because you consented when you created your account, and because we
                            need it to carry out the order you placed with us. We keep some records, such as sales and
                            audit entries, because a business is required to keep them.
                        </p>
                    </Section>

                    <Section title="Who else can see it">
                        <p>
                            We do not sell your information, and we do not share it for anyone else&rsquo;s marketing.
                            It is handled on our behalf by the services that run this system:
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                <strong>Supabase</strong> — stores the database and the files you upload, on servers in{' '}
                                <strong>South Korea</strong>.
                            </li>
                            <li>
                                <strong>Vercel</strong> — runs the website itself, from servers in{' '}
                                <strong>Australia</strong>.
                            </li>
                            <li>
                                <strong>Google</strong> — checks that sign-up and contact forms are not being filled in
                                by a bot (reCAPTCHA), and carries the emails we send you.
                            </li>
                        </ul>
                        <p>
                            Because of this, your information is stored and processed outside the Philippines. We use
                            these providers under their own data protection terms, and we remain answerable to you for
                            it.
                        </p>
                        <p>
                            We will also disclose information where a court, a regulator or the law requires us to.
                        </p>
                    </Section>

                    <Section title="How long we keep it">
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                <strong>Your account details</strong> — for as long as you have an account with us.
                            </li>
                            <li>
                                <strong>Orders, sales records and the payment proofs attached to them</strong> — five
                                years from the date of the order, which is the period a business is expected to keep
                                its records.
                            </li>
                            <li>
                                <strong>Reports you file and the photos or video attached</strong> — five years from
                                the date the report is closed.
                            </li>
                            <li>
                                <strong>Audit log entries</strong> — five years, so that a dispute about an old order
                                can still be traced.
                            </li>
                        </ul>
                        <p>
                            After that we delete the records, or strip out what identifies you and keep only totals
                            for our own accounting.
                        </p>
                    </Section>

                    <Section title="How we protect it">
                        <p>
                            The site is served over HTTPS, so what travels between your device and us is encrypted.
                            Passwords are hashed. Only staff accounts with the right role can open the admin screens,
                            and what they do there is written to an audit log. Access to the database is limited to the
                            people who maintain the system.
                        </p>
                        <p>
                            No system is perfectly safe. If a breach ever puts your information at real risk, we will
                            notify you and the National Privacy Commission as the law requires.
                        </p>
                    </Section>

                    <Section title="Your rights">
                        <p>Under the Data Privacy Act you may:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>be told what information we hold about you, and ask for a copy of it;</li>
                            <li>have anything wrong or out of date corrected;</li>
                            <li>
                                ask us to erase or block information, where it is no longer needed or was collected
                                unlawfully;
                            </li>
                            <li>object to how we use it;</li>
                            <li>ask for your data in a portable form;</li>
                            <li>withdraw the consent you gave, without it affecting what we did before you withdrew it;</li>
                            <li>be compensated for damage caused by false or unlawfully obtained information;</li>
                            <li>complain to the National Privacy Commission at privacy.gov.ph.</li>
                        </ul>
                        <p>
                            Your date of birth cannot be changed from your own settings, because it controls an age
                            limit. If it was entered wrongly, contact us and we will correct it for you.
                        </p>
                        <p>
                            To delete your account, contact us. Some records of completed sales are kept even then,
                            because the law requires a business to keep them; we will tell you what stays and why.
                        </p>
                    </Section>

                    <Section title="How to reach us">
                        <p>
                            Write to us about anything on this page — a copy of your data, a correction, a deletion,
                            or a complaint — and we will answer.
                        </p>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                            <p className="font-semibold text-gray-900 dark:text-white">Data Protection Officer</p>
                            <p className="text-gray-700 dark:text-gray-300">Mejeck IcePlant</p>
                            <p className="mt-2">
                                <a
                                    href="mailto:harrismanabat3@gmail.com"
                                    className="font-medium text-cyan-600 hover:underline dark:text-cyan-400"
                                >
                                    harrismanabat3@gmail.com
                                </a>
                            </p>
                            <p>
                                <a
                                    href="tel:+639686001910"
                                    className="font-medium text-cyan-600 hover:underline dark:text-cyan-400"
                                >
                                    +63 968 600 1910
                                </a>
                            </p>
                        </div>
                        <p>
                            You can also use the{' '}
                            <a href="/#contact" className="font-medium text-cyan-600 hover:underline dark:text-cyan-400">
                                contact form
                            </a>{' '}
                            on our home page. Email reaches us most directly, so please use it if your request is
                            about your own information.
                        </p>
                        <p>
                            If you are not satisfied with how we handle it, you may bring the matter to the National
                            Privacy Commission at{' '}
                            <a
                                href="https://privacy.gov.ph"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-cyan-600 hover:underline dark:text-cyan-400"
                            >
                                privacy.gov.ph
                            </a>
                            .
                        </p>
                    </Section>

                    <Section title="Changes to this notice">
                        <p>
                            If we change how we handle your information we will update this page and change the date at
                            the top. Where the change is significant we will ask for your consent again.
                        </p>
                    </Section>
                </div>
            </div>
        </div>
    );
}
