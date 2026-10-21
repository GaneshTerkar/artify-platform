import { api } from "./api";

export type CheckoutResponse = {
  provider: "manual" | "razorpay";
  order_id: string;
  amount: number;
  amount_paise?: number;
  currency: string;
  payment_id?: string;
  checkout_url?: string;
  session_id?: string;
  key_id?: string;
  razorpay_order_id?: string;
};

export type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = { open: () => void };

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export type CheckoutResult = { status: "paid" | "dismissed" | "redirected" };

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<boolean> | null = null;

function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Starts checkout for an order. Manual mode redirects to the mock checkout
 * page; Razorpay mode opens the Checkout modal and verifies the payment
 * signature on the server before reporting success.
 */
export async function startCheckout(orderId: string): Promise<CheckoutResult> {
  const res = await api<CheckoutResponse>(`/api/v1/orders/${orderId}/checkout`, {
    method: "POST",
  });

  if (res.provider === "razorpay" && res.razorpay_order_id && res.key_id) {
    const loaded = await loadRazorpay();
    if (!loaded) {
      throw new Error("Could not load the payment window. Check your internet connection and try again.");
    }

    return new Promise<CheckoutResult>((resolve, reject) => {
      const rzp = new window.Razorpay!({
        key: res.key_id as string,
        amount: res.amount_paise ?? Math.round(res.amount * 100),
        currency: res.currency,
        name: "ArtifyMe",
        description: `Commission #${res.order_id.slice(0, 8).toUpperCase()}`,
        order_id: res.razorpay_order_id as string,
        theme: { color: "#6366f1" },
        handler: async (response) => {
          try {
            await api("/api/v1/payments/verify", {
              method: "POST",
              body: JSON.stringify(response),
            });
            resolve({ status: "paid" });
          } catch (err) {
            reject(err instanceof Error ? err : new Error("Payment verification failed"));
          }
        },
        modal: {
          ondismiss: () => resolve({ status: "dismissed" }),
        },
      });
      rzp.open();
    });
  }

  if (res.checkout_url) {
    window.location.href = res.checkout_url;
    return { status: "redirected" };
  }

  throw new Error("The server did not return a payment method.");
}
