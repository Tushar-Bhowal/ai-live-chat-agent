import type { Tool } from "./tool.js";

interface MockOrder {
  status: "processing" | "shipped" | "out_for_delivery" | "delivered";
  carrier?: string;
  estimatedDelivery?: string;
  placedOn: string;
  items: number;
}

// Stand-in for a real orders service; swapping this for a live API call
// wouldn't change anything else.
const MOCK_ORDERS: Record<string, MockOrder> = {
  "ORD-1001": {
    status: "shipped",
    carrier: "BlueDart",
    estimatedDelivery: "2026-06-24",
    placedOn: "2026-06-19",
    items: 2,
  },
  "ORD-1002": {
    status: "processing",
    placedOn: "2026-06-20",
    items: 1,
  },
  "ORD-1003": {
    status: "delivered",
    carrier: "Delhivery",
    estimatedDelivery: "2026-06-18",
    placedOn: "2026-06-10",
    items: 3,
  },
};

export const orderStatusTool: Tool = {
  name: "check_order_status",
  description:
    "Look up the current status, carrier, and delivery estimate for a customer's order by its order id (format ORD-XXXX).",
  parameters: {
    type: "object",
    properties: {
      orderId: {
        type: "string",
        description: "The order id to look up, e.g. ORD-1001.",
      },
    },
    required: ["orderId"],
    additionalProperties: false,
  },
  async execute(args) {
    const orderId = String(args["orderId"] ?? "")
      .trim()
      .toUpperCase();
    const order = MOCK_ORDERS[orderId];
    if (!order) {
      return JSON.stringify({ found: false, orderId });
    }
    return JSON.stringify({ found: true, orderId, ...order });
  },
};
