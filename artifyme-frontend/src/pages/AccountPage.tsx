import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Order } from "../types/order";

export default function AccountPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => api<{ orders: Order[] }>("/api/v1/orders"),
  });

  if (isLoading) return <p className="text-slate-400">Loading orders…</p>;
  if (error) return <p className="text-red-400">Could not load orders.</p>;

  const orders = data?.orders ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your orders</h1>
        <Link to="/order" className="text-sm text-brand">
          New order
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="text-slate-400">No orders yet.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.order_id} className="rounded-xl bg-brand-muted p-4 text-sm">
              <div className="flex justify-between">
                <span className="font-medium capitalize">{o.lifecycle_label.replace("_", " ")}</span>
                <span>₹{o.total_price.toFixed(0)}</span>
              </div>
              <p className="text-slate-400">{new Date(o.created_at).toLocaleString()}</p>
              {o.final_image_url && (
                <a
                  href={o.final_image_url}
                  className="mt-2 inline-block text-brand"
                  target="_blank"
                  rel="noreferrer"
                >
                  Download sketch
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
