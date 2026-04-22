import axios from "axios";

const BASE = process.env.PAYMOB_BASE_URL || "https://accept.paymob.com/api";

export async function paymobAuthToken() {
  const { data } = await axios.post(`${BASE}/auth/tokens`, {
    api_key: process.env.PAYMOB_API_KEY,
  });
  return data.token as string;
}

export async function paymobCreateOrder(args: {
  authToken: string;
  amountCents: number;
  currency: string;
  merchantOrderId: string;
}) {
  const { data } = await axios.post(`${BASE}/ecommerce/orders`, {
    auth_token: args.authToken,
    delivery_needed: "false",
    amount_cents: String(args.amountCents),
    currency: args.currency,
    merchant_order_id: args.merchantOrderId,
    items: [
      {
        name: "Bimo Coinz",
        amount_cents: String(args.amountCents),
        description: "Coinz topup",
        quantity: "1",
      },
    ],
  });

  return data as { id: number };
}

export async function paymobPaymentKey(args: {
  authToken: string;
  amountCents: number;
  currency: string;
  orderId: number;
  integrationId: number;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  };
}) {
  const { data } = await axios.post(`${BASE}/acceptance/payment_keys`, {
    auth_token: args.authToken,
    amount_cents: String(args.amountCents),
    expiration: 3600,
    order_id: args.orderId,
    currency: args.currency,
    integration_id: args.integrationId,
    billing_data: {
      apartment: "NA",
      email: args.billing.email,
      floor: "NA",
      first_name: args.billing.first_name,
      street: "NA",
      building: "NA",
      phone_number: args.billing.phone_number,
      shipping_method: "NA",
      postal_code: "NA",
      city: "NA",
      country: "EG",
      last_name: args.billing.last_name,
      state: "NA",
    },
  });

  return data.token as string;
}