import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function ContactPage() {
  const { user } = useAuth();

  if (user?.role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  const [form, setForm] = useState({
    fullName: user?.full_name ?? "",
    email: user?.email ?? "",
    phone: "",
    inquiryType: "Custom Portrait Inquiry",
    subject: "",
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<{
    id: string;
    submittedAt: string;
  } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate sending message directly to studio administration
    setTimeout(() => {
      const ticketId = `ART-MSG-${Math.floor(100000 + Math.random() * 900000)}`;
      setSubmittedTicket({
        id: ticketId,
        submittedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      setIsSubmitting(false);
    }, 600);
  }

  function handleReset() {
    setSubmittedTicket(null);
    setForm({
      fullName: user?.full_name ?? "",
      email: user?.email ?? "",
      phone: "",
      inquiryType: "Custom Portrait Inquiry",
      subject: "",
      message: "",
    });
  }

  return (
    <div className="space-y-10 max-w-4xl mx-auto w-full">
      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-[#0e1629] to-[#1a0f2e] p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-gradient-to-br from-pink-500/15 via-purple-500/10 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-gradient-to-r from-purple-500/15 via-pink-500/15 to-amber-500/15 px-3.5 py-1 text-xs font-semibold text-pink-300 shadow-inner backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-400" />
            </span>
            <span className="tracking-wide uppercase text-[11px] font-bold">Studio Concierge & Support</span>
            <span className="text-white/40">•</span>
            <span className="text-xs text-amber-300">Direct Admin Channel</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Connect Directly with{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
              ArtifyMe Administration
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
            Have a question about a commissioned portrait, artist verification, custom framing sizes, or delivery logistics? Send a message directly to our studio administration team below.
          </p>
        </div>
      </section>

      {/* Direct Contact Channels Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-brand-muted p-4 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-lg">
            ✉️
          </div>
          <h4 className="text-sm font-bold text-white">Direct Admin Email</h4>
          <p className="text-xs text-slate-400">Response within 2-4 hours</p>
          <a
            href="mailto:terkarganesh2709@gmail.com"
            className="text-xs font-semibold text-brand hover:underline block pt-1"
          >
            terkarganesh2709@gmail.com
          </a>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-brand-muted p-4 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-lg">
            📞
          </div>
          <h4 className="text-sm font-bold text-white">Phone & WhatsApp</h4>
          <p className="text-xs text-slate-400">Mon–Sat, 9 AM – 8 PM IST</p>
          <a
            href="https://wa.me/918484937920"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-brand hover:underline block pt-1"
          >
            +91 8484937920
          </a>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-brand-muted p-4 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-lg">
            🎨
          </div>
          <h4 className="text-sm font-bold text-white">Studio Atelier</h4>
          <p className="text-xs text-slate-400">Fine Art Studio Workshop</p>
          <span className="text-xs text-slate-300 block pt-1 leading-snug">
            Flat No. 103, Lakshmi Park, Shivkrishna Society, Mhasoba Wasti, Manjrai Mundhawa Road, Pune, 412307
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-brand-muted p-4 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-lg">
            ⏱️
          </div>
          <h4 className="text-sm font-bold text-white">Operational Hours</h4>
          <p className="text-xs text-slate-400">Studio & Dispatch Timings</p>
          <span className="text-xs text-slate-300 block pt-1 leading-snug">
            Mon–Sat: 9:00 AM – 8:00 PM<br />Sun: 10:00 AM – 4:00 PM
          </span>
        </div>
      </div>

      {/* Main Interactive Contact Form or Success State */}
      <section className="rounded-3xl border border-slate-800 bg-brand-muted p-6 sm:p-8 shadow-xl">
        {submittedTicket ? (
          <div className="text-center py-8 space-y-4 max-w-lg mx-auto animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              ✓
            </div>
            <div className="space-y-1">
              <span className="text-xs font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full">
                Ticket Ref: {submittedTicket.id}
              </span>
              <h3 className="text-2xl font-bold text-white pt-2">Message Received by Studio Admin</h3>
              <p className="text-xs sm:text-sm text-slate-300">
                Thank you, <strong>{form.fullName}</strong>. Your message regarding <em>&quot;{form.subject}&quot;</em> has been routed directly to the ArtifyMe administrator. We will reply to <strong>{form.email}</strong> shortly.
              </p>
            </div>

            <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 text-left text-xs text-slate-300 space-y-1.5 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="text-white font-medium">{form.inquiryType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-white font-medium">{submittedTicket.submittedAt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Direct Support:</span>
                <span className="text-brand font-medium">terkarganesh2709@gmail.com</span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl border border-slate-600 bg-slate-800/80 hover:bg-slate-700 px-5 py-2.5 text-xs font-semibold text-slate-200 transition"
              >
                Send Another Message
              </button>
              <Link
                to="/"
                className="rounded-xl bg-brand hover:opacity-90 px-5 py-2.5 text-xs font-semibold text-white transition shadow-sm"
              >
                Return to Gallery
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-xl font-bold text-white">Direct Message to Studio Administration</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Fill in the details below to reach out directly to the studio admin.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1 text-xs sm:text-sm font-medium text-slate-300">
                <span>Your Full Name <span className="text-pink-400">*</span></span>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-brand focus:outline-none transition text-sm"
                />
              </label>

              <label className="block space-y-1 text-xs sm:text-sm font-medium text-slate-300">
                <span>Email Address <span className="text-pink-400">*</span></span>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-brand focus:outline-none transition text-sm"
                />
              </label>

              <label className="block space-y-1 text-xs sm:text-sm font-medium text-slate-300">
                <span>Phone / WhatsApp Number</span>
                <input
                  type="tel"
                  placeholder="e.g. +91 8484937920"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-brand focus:outline-none transition text-sm"
                />
              </label>

              <label className="block space-y-1 text-xs sm:text-sm font-medium text-slate-300">
                <span>Inquiry Category <span className="text-pink-400">*</span></span>
                <select
                  value={form.inquiryType}
                  onChange={(e) => setForm({ ...form, inquiryType: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-white focus:border-brand focus:outline-none transition text-sm"
                >
                  <option value="Custom Portrait Inquiry">🎨 Custom Portrait Inquiry</option>
                  <option value="Order Status & Tracking">📍 Order Status & Tracking</option>
                  <option value="Artist Application & Verification">🖌️ Artist Application & Verification</option>
                  <option value="Delivery & Logistics">🚚 Delivery & Courier Logistics</option>
                  <option value="Corporate / Bulk Commission">🏢 Corporate & Bulk Commission</option>
                  <option value="Direct Admin Assistance">👑 Direct Admin Assistance</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1 text-xs sm:text-sm font-medium text-slate-300">
              <span>Subject <span className="text-pink-400">*</span></span>
              <input
                type="text"
                required
                placeholder="Brief summary of your inquiry"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-brand focus:outline-none transition text-sm"
              />
            </label>

            <label className="block space-y-1 text-xs sm:text-sm font-medium text-slate-300">
              <span>Your Message <span className="text-pink-400">*</span></span>
              <textarea
                required
                rows={5}
                placeholder="Please describe your question, requested portrait details, custom canvas dimensions, or any specific requirements..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-brand focus:outline-none transition text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-cyan-500 via-pink-500 to-amber-400 text-slate-950 font-extrabold px-8 py-3.5 text-sm shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                  <span>Submitting to Admin...</span>
                </>
              ) : (
                <>
                  <span>📨</span>
                  <span>Send Message to Admin</span>
                </>
              )}
            </button>
          </form>
        )}
      </section>

      {/* Helpful Studio FAQs */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-white">Frequently Asked Questions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-brand-muted p-4 space-y-1.5">
            <h4 className="text-sm font-semibold text-white">How long does custom portrait creation take?</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Classical handcrafted artwork requires 3–5 working days for our master artists to sketch, paint, and apply protective sealant. Tracked courier transit takes an additional 2–3 business days.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-brand-muted p-4 space-y-1.5">
            <h4 className="text-sm font-semibold text-white">Can I preview the portrait before it is delivered?</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Yes! Every commissioned painting receives high-resolution proof upload for client approval and admin sign-off before proceeding to protective packaging and courier dispatch.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-brand-muted p-4 space-y-1.5">
            <h4 className="text-sm font-semibold text-white">What art mediums and paper are used?</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              We exclusively use 300 GSM archival cold-pressed cotton paper and premium artist-grade pigments (Winsor & Newton graphite, charcoal, watercolor, acrylic, and oil).
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-brand-muted p-4 space-y-1.5">
            <h4 className="text-sm font-semibold text-white">Can separate photos be combined into one portrait?</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Yes! Our master artists specialize in composite portrait compositions, allowing you to seamlessly bring together family members, loved ones, or pets from different photos.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
