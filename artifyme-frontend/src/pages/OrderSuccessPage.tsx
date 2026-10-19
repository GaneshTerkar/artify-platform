import { Link, useSearchParams } from "react-router-dom";

export default function OrderSuccessPage() {
  const [params] = useSearchParams();
  const orderId = params.get("order_id");

  return (
    <main className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold">Thank you!</h1>
      <p className="text-slate-300">
        {orderId
          ? `Order #${orderId.slice(0, 8)} was placed successfully! Our curators are reviewing your reference photo to assign it to an expert artist.`
          : "Your payment is being confirmed."}
      </p>
      <Link to="/account" className="inline-block rounded-xl bg-brand px-6 py-3 font-medium">
        View orders
      </Link>
    </main>
  );
}
