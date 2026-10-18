import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Footer() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();

  // Admin should not see the footer
  if (user?.role === "ADMIN") {
    return null;
  }

  return (
    <footer className="mt-16 sm:mt-24 border-t border-slate-800/80 pt-12 pb-8 text-slate-400">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-10 pb-12 border-b border-slate-800/60">
        {/* Brand & Studio Bio Column (2 cols wide on large screens) */}
        <div className="lg:col-span-2 space-y-4">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <img
              src="/artifyme-icon.png"
              alt="ArtifyMe Logo"
              className="w-8 h-8 rounded-full object-cover shadow-sm ring-1 ring-white/10 group-hover:scale-105 transition"
            />
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
              ArtifyMe
            </span>
          </Link>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm">
            Handmade fine art portrait studio. Transforming cherished family memories, pets, and loved ones into authentic, museum-grade artwork painted on 300 GSM archival cotton.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-300">
              <span className="text-emerald-400">✓</span> 100% Real Human Artists
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-300">
              <span className="text-cyan-400">✓</span> Archival Cotton Paper
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-300">
              <span className="text-amber-400">✓</span> Tracked Courier Delivery
            </span>
          </div>
        </div>

        {/* Mediums & Styles */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">Fine Art Styles</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link to="/order?category=PENCIL" className="hover:text-white transition">
                Graphite Pencil Sketch
              </Link>
            </li>
            <li>
              <Link to="/order?category=CHARCOAL" className="hover:text-white transition">
                Expressive Charcoal
              </Link>
            </li>
            <li>
              <Link to="/order?category=WATERCOLOR" className="hover:text-white transition">
                Luminous Watercolor
              </Link>
            </li>
            <li>
              <Link to="/order?category=ACRYLIC" className="hover:text-white transition">
                Vibrant Acrylic
              </Link>
            </li>
            <li>
              <Link to="/order?category=OIL" className="hover:text-white transition">
                Classical Oil Portrait
              </Link>
            </li>
            <li className="pt-1">
              <a href="/#gallery" className="text-brand font-medium hover:underline">
                Explore Studio Gallery →
              </a>
            </li>
          </ul>
        </div>

        {/* Customer & Studio Links */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">Studio Concierge</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link to="/order" className="hover:text-white transition">
                Order Custom Sketch
              </Link>
            </li>
            {user?.role !== "ADMIN" && (
              <li>
                <Link to="/contact" className="hover:text-white transition">
                  Contact Us & Admin Support
                </Link>
              </li>
            )}
            {user ? (
              <>
                {user.role === "ADMIN" ? (
                  <>
                    <li>
                      <Link to="/admin?tab=orders" className="hover:text-white transition">
                        👑 Studio Orders Queue
                      </Link>
                    </li>
                    <li>
                      <Link to="/admin?tab=users" className="hover:text-white transition">
                        👥 Users & Artist Directory
                      </Link>
                    </li>
                    <li>
                      <Link to="/admin?tab=payroll" className="hover:text-white transition">
                        💰 Studio Payroll Ledger
                      </Link>
                    </li>
                  </>
                ) : (
                  <li>
                    <Link to="/account" className="hover:text-white transition">
                      {user.role === "ARTIST"
                        ? "🎨 My Commissions"
                        : user.role === "DELIVERY_AGENT"
                        ? "🚚 Courier Deliveries"
                        : "📦 My Orders & Tracking"}
                    </Link>
                  </li>
                )}
              </>
            ) : (
              <>
                <li>
                  <Link to="/login" className="hover:text-white transition">
                    Sign in to Account
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-white transition">
                    Create New Account
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>

        {/* Direct Studio Support */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">Studio Support</h4>
          <div className="space-y-2.5 text-xs">
            <div>
              <span className="block text-[11px] text-slate-400">Admin Email:</span>
              <a href="mailto:terkarganesh2709@gmail.com" className="text-slate-200 font-medium hover:text-brand transition">
                terkarganesh2709@gmail.com
              </a>
            </div>
            <div>
              <span className="block text-[11px] text-slate-400">Helpline & WhatsApp:</span>
              <a
                href="https://wa.me/918484937920"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-200 font-medium hover:text-brand transition"
              >
                +91 8484937920
              </a>
            </div>
            <div>
              <span className="block text-[11px] text-slate-400">Atelier Workshop:</span>
              <span className="text-slate-300">
                Flat No. 103, Lakshmi Park, Shivkrishna Society, Mhasoba Wasti, Manjrai Mundhawa Road, Pune, 412307
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-slate-400">Operating Hours:</span>
              <span className="text-slate-300">
                Mon–Sat: 9 AM – 8 PM IST
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Copyright & Attribution */}
      <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>&copy; {currentYear} ArtifyMe Fine Art Studio. All rights reserved.</span>
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          {user?.role !== "ADMIN" && (
            <>
              <Link to="/contact" className="hover:text-slate-200 transition">
                Studio Support
              </Link>
              <span>•</span>
            </>
          )}
          <span className="text-slate-400">Zero AI Filters — 100% Hand-Crafted</span>
        </div>
      </div>
    </footer>
  );
}
