import type { Locale } from "@/i18n/routing";
import type { RequestOptions, Requester } from "./http";
import type {
  Address,
  AddressInput,
  AddressList,
  Bill,
  CancellationReason,
  CargoStatus,
  CartItemInput,
  Category,
  CategoryDetail,
  CheckoutSession,
  Communication,
  CreateReturnInput,
  CursorPage,
  Customer,
  Id,
  InvoiceDetail,
  InvoiceSummary,
  LegalDocument,
  LegalSummary,
  LegalType,
  OrderDetail,
  OrderPayment,
  OrderReturns,
  OrderSummary,
  OrderingPermission,
  OtpRequestResult,
  Page,
  PayLink,
  PlaceOrderInput,
  PlaceOrderResult,
  ProductDetail,
  ProductQuery,
  ProductSummary,
  ReturnRequest,
  SessionResult,
  ShopSettings,
  UnsubscribeResult,
  UpdateCommunicationInput,
  UpdateProfileInput,
} from "./types";

/** What a single call may set besides its own parameters. */
export type CallOptions = Pick<
  RequestOptions,
  "locale" | "signal" | "next" | "cache"
>;

const seg = encodeURIComponent;

/**
 * Every endpoint of the store API the shop uses, once. The same definition
 * serves the browser (with the session transport) and the server (public
 * data with the Next.js cache).
 */
export function createStoreApi(request: Requester) {
  return {
    // --- 1 Authentication ---------------------------------------------------
    requestOtp: (input: { email: string; locale?: Locale }, o?: CallOptions) =>
      request<OtpRequestResult>("/v1/store/auth/otp/request", {
        ...o,
        method: "POST",
        body: input,
      }),
    verifyOtp: (
      input: { email: string; code: string; locale?: Locale },
      o?: CallOptions,
    ) =>
      request<SessionResult>("/v1/store/auth/otp/verify", {
        ...o,
        method: "POST",
        body: input,
      }),
    signInWithGoogle: (
      input: { idToken: string; locale?: Locale },
      o?: CallOptions,
    ) =>
      request<SessionResult>("/v1/store/auth/google", {
        ...o,
        method: "POST",
        body: input,
      }),
    logout: (o?: CallOptions) =>
      request<void>("/v1/store/auth/logout", { ...o, method: "POST" }),
    logoutAll: (o?: CallOptions) =>
      request<void>("/v1/store/auth/logout-all", { ...o, method: "POST" }),

    // --- 2 Account ----------------------------------------------------------
    getMe: (o?: CallOptions) =>
      request<{ customer: Customer }>("/v1/store/me", o),
    updateMe: (input: UpdateProfileInput, o?: CallOptions) =>
      request<{ customer: Customer }>("/v1/store/me", {
        ...o,
        method: "PATCH",
        body: input,
      }),
    updateCommunication: (input: UpdateCommunicationInput, o?: CallOptions) =>
      request<{ communication: Communication }>("/v1/store/me/communication", {
        ...o,
        method: "PATCH",
        body: input,
      }),
    getOrderingPermission: (o?: CallOptions) =>
      request<OrderingPermission>("/v1/store/me/ordering", o),

    // --- 3 Addresses --------------------------------------------------------
    listAddresses: (o?: CallOptions) =>
      request<AddressList>("/v1/store/me/addresses", o),
    createAddress: (input: AddressInput, o?: CallOptions) =>
      request<AddressList>("/v1/store/me/addresses", {
        ...o,
        method: "POST",
        body: input,
      }),
    updateAddress: (id: Id, input: Partial<AddressInput>, o?: CallOptions) =>
      request<AddressList>(`/v1/store/me/addresses/${seg(id)}`, {
        ...o,
        method: "PATCH",
        body: input,
      }),
    setDefaultAddress: (id: Address["id"], o?: CallOptions) =>
      request<AddressList>(`/v1/store/me/addresses/${seg(id)}/default`, {
        ...o,
        method: "POST",
      }),
    deleteAddress: (id: Id, o?: CallOptions) =>
      request<AddressList>(`/v1/store/me/addresses/${seg(id)}`, {
        ...o,
        method: "DELETE",
      }),

    // --- 4 Unsubscribe link -------------------------------------------------
    unsubscribe: (token: string, o?: CallOptions) =>
      request<UnsubscribeResult>(`/v1/unsubscribe/${seg(token)}`, {
        ...o,
        method: "POST",
      }),

    // --- 6 Settings and legal texts -----------------------------------------
    getSettings: (o?: CallOptions) =>
      request<ShopSettings>("/v1/store/settings", o),
    listLegal: (o?: CallOptions) =>
      request<{ items: LegalSummary[] }>("/v1/store/legal", o),
    getLegal: (type: LegalType, o?: CallOptions) =>
      request<{ document: LegalDocument }>(`/v1/store/legal/${seg(type)}`, o),

    // --- 7 Catalogue and cargo ----------------------------------------------
    getCargo: (o?: CallOptions) => request<CargoStatus>("/v1/store/cargo", o),
    listCategories: (o?: CallOptions) =>
      request<{ items: Category[] }>("/v1/store/categories", o),
    getCategory: (slug: string, o?: CallOptions) =>
      request<{ category: CategoryDetail }>(
        `/v1/store/categories/${seg(slug)}`,
        o,
      ),
    listProducts: (query: ProductQuery = {}, o?: CallOptions) =>
      request<Page<ProductSummary>>("/v1/store/products", {
        ...o,
        query: { ...query },
      }),
    getProduct: (slug: string, o?: CallOptions) =>
      request<{ product: ProductDetail }>(`/v1/store/products/${seg(slug)}`, o),

    // --- 8 Cart -------------------------------------------------------------
    previewCart: (items: CartItemInput[], o?: CallOptions) =>
      request<Bill>("/v1/store/cart/preview", {
        ...o,
        method: "POST",
        body: { items },
      }),
    getCart: (o?: CallOptions) => request<Bill>("/v1/store/cart", o),
    mergeCart: (items: CartItemInput[], o?: CallOptions) =>
      request<Bill>("/v1/store/cart/merge", {
        ...o,
        method: "POST",
        body: { items },
      }),
    setCartItem: (productId: Id, quantity: number, o?: CallOptions) =>
      request<Bill>(`/v1/store/cart/items/${seg(productId)}`, {
        ...o,
        method: "PUT",
        body: { quantity },
      }),
    removeCartItem: (productId: Id, o?: CallOptions) =>
      request<Bill>(`/v1/store/cart/items/${seg(productId)}`, {
        ...o,
        method: "DELETE",
      }),
    clearCart: (o?: CallOptions) =>
      request<Bill>("/v1/store/cart", { ...o, method: "DELETE" }),

    // --- 9 Orders -----------------------------------------------------------
    /**
     * Confirms the stored cart as a binding pre-order. The idempotency key
     * is made when the customer reaches the confirm step and reused on every
     * retry: the same key answers with the first order.
     */
    placeOrder: (
      input: PlaceOrderInput,
      idempotencyKey: string,
      o?: CallOptions,
    ) =>
      request<PlaceOrderResult>("/v1/store/orders", {
        ...o,
        method: "POST",
        body: input,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    listOrders: (
      query: { limit?: number; cursor?: string } = {},
      o?: CallOptions,
    ) => request<CursorPage<OrderSummary>>("/v1/store/orders", { ...o, query }),
    getOrder: (orderNumber: string, o?: CallOptions) =>
      request<{ order: OrderDetail }>(
        `/v1/store/orders/${seg(orderNumber)}`,
        o,
      ),
    cancelOrder: (
      orderNumber: string,
      input: { reason: CancellationReason; text?: string },
      o?: CallOptions,
    ) =>
      request<{ order: OrderDetail }>(
        `/v1/store/orders/${seg(orderNumber)}/cancel`,
        { ...o, method: "POST", body: input },
      ),

    // --- 10 Payments --------------------------------------------------------
    /** Also the call after the return from Stripe: it asks Stripe first. */
    getOrderPayment: (orderNumber: string, o?: CallOptions) =>
      request<OrderPayment>(`/v1/store/orders/${seg(orderNumber)}/payment`, o),
    createOrderCheckout: (orderNumber: string, o?: CallOptions) =>
      request<CheckoutSession>(
        `/v1/store/orders/${seg(orderNumber)}/checkout`,
        { ...o, method: "POST" },
      ),
    getPayLink: (token: string, o?: CallOptions) =>
      request<PayLink>(`/v1/pay/${seg(token)}`, o),
    createPayLinkCheckout: (token: string, o?: CallOptions) =>
      request<CheckoutSession>(`/v1/pay/${seg(token)}/checkout`, {
        ...o,
        method: "POST",
      }),

    // --- 11 Invoices and credit notes ---------------------------------------
    listInvoices: (
      query: { orderNumber?: string; limit?: number; cursor?: string } = {},
      o?: CallOptions,
    ) =>
      request<CursorPage<InvoiceSummary>>("/v1/store/invoices", {
        ...o,
        query,
      }),
    getInvoice: (number: string, o?: CallOptions) =>
      request<{ invoice: InvoiceDetail }>(
        `/v1/store/invoices/${seg(number)}`,
        o,
      ),

    // --- 12 Returns ---------------------------------------------------------
    getOrderReturns: (orderNumber: string, o?: CallOptions) =>
      request<OrderReturns>(`/v1/store/orders/${seg(orderNumber)}/returns`, o),
    createReturn: (
      orderNumber: string,
      input: CreateReturnInput,
      o?: CallOptions,
    ) =>
      request<{ return: ReturnRequest }>(
        `/v1/store/orders/${seg(orderNumber)}/returns`,
        { ...o, method: "POST", body: input },
      ),
    getReturn: (returnNumber: string, o?: CallOptions) =>
      request<{ return: ReturnRequest }>(
        `/v1/store/returns/${seg(returnNumber)}`,
        o,
      ),
    cancelReturn: (returnNumber: string, o?: CallOptions) =>
      request<{ return: ReturnRequest }>(
        `/v1/store/returns/${seg(returnNumber)}/cancel`,
        { ...o, method: "POST" },
      ),
  };
}

export type StoreApi = ReturnType<typeof createStoreApi>;

/** Path of an invoice PDF, relative to the API base URL (needs the session). */
export function invoicePdfPath(number: string): string {
  return `/v1/store/invoices/${seg(number)}/pdf`;
}
