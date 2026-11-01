import { api } from "@/lib/api/browser";
import { guestInvoicePdfPath, invoicePdfPath } from "@/lib/api/store-api";
import type {
  CheckoutSession,
  CustomerCancellationReason,
  InvoiceSummary,
  OrderDetail,
  OrderPayment,
} from "@/lib/api/types";
import type { OrderScope } from "./orders";

/**
 * How an order is reached: with the session of the signed-in customer
 * (doc 9, 10, 11), or with the token of a guest order (doc 20), which
 * travels as a header and, for the PDF the browser opens, in the query.
 */
export type OrderAccess =
  { kind: "account" } | { kind: "guest"; token: string };

export interface OrderCalls {
  scope: OrderScope;
  getOrder: (orderNumber: string) => Promise<OrderDetail>;
  /** The freshest word on the payment: the API asks Stripe about an open page first. */
  getPayment: (orderNumber: string) => Promise<OrderPayment>;
  /** The invoice and its credit notes, oldest first; empty while not paid. */
  listDocuments: (orderNumber: string) => Promise<InvoiceSummary[]>;
  /** A payment page for an order that still waits. */
  pay: (orderNumber: string) => Promise<CheckoutSession>;
  cancel: (
    orderNumber: string,
    input: { reason: CustomerCancellationReason; text?: string },
  ) => Promise<{ order: OrderDetail }>;
  /** Where the PDF of a document is, relative to the API base URL. */
  pdfPath: (orderNumber: string, number: string) => string;
}

/**
 * The calls of the order page, by access. A guest order answers its
 * payment and its documents together with the order, so the three reads
 * are one endpoint seen three ways.
 */
export function orderCalls(access: OrderAccess): OrderCalls {
  if (access.kind === "guest") {
    const { token } = access;
    return {
      scope: "guest",
      getOrder: async (orderNumber) =>
        (await api.getGuestOrder(orderNumber, token)).order,
      getPayment: async (orderNumber) => {
        const answer = await api.getGuestOrder(orderNumber, token);
        return {
          orderNumber: answer.order.orderNumber,
          status: answer.order.status,
          payment: answer.payment,
          documents: answer.documents,
        };
      },
      listDocuments: async (orderNumber) =>
        (await api.getGuestOrder(orderNumber, token)).documents,
      pay: (orderNumber) => api.payGuestOrder(orderNumber, token),
      cancel: (orderNumber, input) =>
        api.cancelGuestOrder(orderNumber, token, input),
      pdfPath: (orderNumber, number) =>
        guestInvoicePdfPath(orderNumber, number, token),
    };
  }
  return {
    scope: "account",
    getOrder: async (orderNumber) => (await api.getOrder(orderNumber)).order,
    getPayment: (orderNumber) => api.getOrderPayment(orderNumber),
    listDocuments: async (orderNumber) =>
      (await api.listInvoices({ orderNumber, limit: 100 })).items,
    pay: (orderNumber) => api.createPaymentPage(orderNumber),
    cancel: (orderNumber, input) => api.cancelOrder(orderNumber, input),
    pdfPath: (_orderNumber, number) => invoicePdfPath(number),
  };
}
