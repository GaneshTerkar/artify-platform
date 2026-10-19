import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import PhotoUploader from "../components/PhotoUploader";
import type { Order, Product } from "../types/order";

type Step = 1 | 2 | 3 | 4;

export default function OrderWizardPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const catParam = searchParams.get("category")?.toUpperCase();
  const refParam = searchParams.get("ref_url");
  const initialCategory = catParam && ["PENCIL", "CHARCOAL", "WATERCOLOR", "ACRYLIC", "OIL"].includes(catParam)
    ? catParam
    : "PENCIL";

  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState(initialCategory);
  const [size, setSize] = useState("A4");
  const [persons, setPersons] = useState("SINGLE");
  const [referenceUrl, setReferenceUrl] = useState(refParam || "");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { data: catalog } = useQuery({
    queryKey: ["products"],
    queryFn: () => api<{ products: Product[] }>("/api/v1/products"),
  });

  const product = catalog?.products[0];

  const { data: price } = useQuery({
    queryKey: ["price", category, size, persons],
    queryFn: () =>
      api<{ estimated_total: number; currency: string }>(
        `/api/v1/products/price/estimate?category=${category}&size=${size}&persons=${persons}`,
      ),
  });

  const estimated = price?.estimated_total ?? product?.base_price ?? 0;

  const canNext = useMemo(() => {
    if (step === 1) return true;
    if (step === 2) return referenceUrl.trim().length > 0;
    if (step === 3) return address.trim().length > 0;
    return true;
  }, [step, referenceUrl, address]);

  async function createAndCheckout() {
    setBusy(true);
    setError("");
    try {
      const orderKey = `order-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
      const created = await api<Order>("/api/v1/orders", {
        method: "POST",
        headers: {
          "Idempotency-Key": orderKey,
        },
        body: JSON.stringify({
          painting_category: category,
          size,
          persons_included: persons,
          reference_image_url: referenceUrl,
          delivery_address: address,
          customer_notes: notes || undefined,
        }),
      });
      setOrder(created);
      const checkout = await api<{ checkout_url: string }>(
        `/api/v1/orders/${created.order_id}/checkout`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": `checkout-${created.order_id}`,
          },
        },
      );
      window.location.href = checkout.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto w-full">
      <div>
        <p className="text-sm text-slate-400">Step {step} of 4</p>
        <h1 className="text-2xl font-semibold">Order a portrait sketch</h1>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {step === 1 && product && (
        <section className="space-y-4">
          <Select label="Style" value={category} onChange={setCategory} options={product.categories} />
          <Select label="Size" value={size} onChange={setSize} options={product.sizes} />
          <Select label="Subjects" value={persons} onChange={setPersons} options={product.subjects} />
          <p className="text-lg font-medium">Estimated: ₹{estimated.toFixed(0)}</p>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          {user?.role === "ADMIN" && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <span>⚡</span> Admin Test Helper: Quick-Load Sample Reference Photo
                </span>
                <span className="text-[10px] text-amber-400/80 font-mono">Accessible to Admin</span>
              </div>
              <p className="text-xs text-slate-300">
                Click below to instantly load the classical portrait test reference photo with optimal resolution for sketching:
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReferenceUrl("/uploads/admin_test_fixtures/suite_1_solo_portrait/reference_photo.png");
                    if (!notes) {
                      setNotes("Please capture his wise character and warm expression with rich artisanal textures.");
                    }
                  }}
                  className="rounded-lg bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 border border-amber-500/50 px-3 py-1.5 text-xs font-semibold transition flex items-center gap-2 shadow-sm"
                >
                  <img
                    src="/uploads/admin_test_fixtures/suite_1_solo_portrait/reference_photo.png"
                    alt="Sample"
                    className="w-5 h-5 rounded object-cover"
                  />
                  <span>Load Suite 1 Reference Photo (Elderly Gentleman)</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="block text-sm font-medium">Reference photo</span>
            <PhotoUploader value={referenceUrl} onChange={setReferenceUrl} />
          </div>

          <label className="block space-y-1 text-sm">
            <span>Notes for the artist (optional)</span>
            <textarea
              className="w-full rounded-lg border border-slate-600 bg-brand-muted px-3 py-2 text-white placeholder-slate-500"
              rows={3}
              placeholder="Any specific requests, style preferences, or details to highlight..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-3">
          {user?.role === "ADMIN" && (
            <button
              type="button"
              onClick={() => setAddress("ArtifyMe Headquarters, 402 Baner Road, Pune, Maharashtra 411045")}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium underline flex items-center gap-1"
            >
              <span>⚡</span> Quick-fill Admin Testing Delivery Address
            </button>
          )}
          <label className="block space-y-1 text-sm">
            <span>Delivery address (or &quot;Digital only&quot;)</span>
            <textarea
              required
              className="w-full rounded-lg border border-slate-600 bg-brand-muted px-3 py-2"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
        </section>
      )}

      {step === 4 && (
        <section className="rounded-xl bg-brand-muted p-4 text-sm space-y-2">
          <p>
            <strong>Style:</strong> {category} · {size} · {persons}
          </p>
          <p>
            <strong>Total:</strong> ₹{estimated.toFixed(0)}
          </p>
          {order && (
            <p className="text-slate-400">Order ID: {order.order_id}</p>
          )}
        </section>
      )}

      <div className="flex gap-3">
        {step > 1 && (
          <button
            type="button"
            className="flex-1 rounded-xl border border-slate-600 py-3"
            onClick={() => setStep((s) => (s - 1) as Step)}
          >
            Back
          </button>
        )}
        {step < 4 ? (
          <button
            type="button"
            disabled={!canNext}
            className="flex-1 rounded-xl bg-brand py-3 font-medium disabled:opacity-40"
            onClick={() => setStep((s) => (s + 1) as Step)}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            className="flex-1 rounded-xl bg-brand py-3 font-medium disabled:opacity-40"
            onClick={createAndCheckout}
          >
            {busy ? "Processing…" : "Pay & place order"}
          </button>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      <select
        className="w-full rounded-lg border border-slate-600 bg-brand-muted px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
