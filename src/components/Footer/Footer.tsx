import Link from "next/link";

const footerLinks = [
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/support", label: "Support" },
];

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 w-full border-t border-white/10 bg-[#08080a] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 flex flex-col gap-14">

        {/* Top Section */}
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr]">
          {/* Brand + Description */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex flex-col gap-1">
              <span className="text-2xl font-semibold tracking-tight text-white">
                BR
                <span className="bg-gradient-to-r from-[#108fea]  to-[#108fea] bg-clip-text text-transparent">
                  -MAX
                </span>
              </span>
              <span className="text-sm text-gray-400">
                Craft cinematic iMessage stories with professional polish.
              </span>
            </Link>

            <p className="max-w-xl text-sm text-gray-400 leading-relaxed">
              BR-MAX is your studio for building branded chat experiences.
              Create scripts, customize visuals, configure audio, and generate
              production-ready iMessage videos — all in one place.
            </p>

            {/* 🔥 Primary CTA Button */}
            <a
              href="https://discord.gg/h4chRAbjEZ"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex mt-3 px-5 py-3 rounded-xl font-medium text-white
              bg-gradient-to-r from-[#108fea]  to-[#7C80FF]
              shadow-[0_0_20px_rgba(88,101,242,0.4)]
              hover:opacity-95 transition-all"
            >
              💬 Join the BR-MAX Discord
            </a>
          </div>

          {/* Support Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-300">
              Need Assistance?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-300">
              For support, feature requests, or urgent issues, reach out via our
              Discord community. Maintainers are active and will respond quickly.
            </p>

            {/* Mini secondary link */}
            <a
              href="https://discord.gg/h4chRAbjEZ"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-semibold text-white underline-offset-2 hover:underline"
            >
              Contact SleepingBattery
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col items-start justify-between gap-4 border-t border-white/5 pt-6 text-sm text-gray-400 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors duration-200 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="text-xs text-gray-500">
            © {year} BR-MAX. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
};

export default Footer;