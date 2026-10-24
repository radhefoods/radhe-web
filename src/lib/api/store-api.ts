import type { Locale } from "@/i18n/routing";
import type { RequestOptions, Requester } from "./http";
import type {
  Address,
  AddressInput,
  AddressList,
  Banner,
  Bill,
  CartItemInput,
  Category,
  CategoryDetail,
  CheckoutInput,
  CheckoutResult,
  CheckoutSession,
  Communication,
  CreateReturnInput,
  CursorPage,
  Customer,
  CustomerCancellationReason,
  Id,
  InvoiceDetail,
  InvoiceSummary,
  LegalDocument,
  LegalSummary,
  LegalType,
  LoginInput,
  OrderDetail,
  OrderPayment,
  OrderReturns,
  OrderSummary,
  ProductDetail,
  ProductFacets,
  ProductList,
  ProductQuery,
  ReturnRequest,
  SessionResult,
  ShopSettings,
  SignUpInput,
  UnsubscribeResult,
  UpdateCommunicationInput,
  UpdateProfileInput,
  Wishlist,
  WishlistEntryInput,
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
    /** Creates the account and signs it in on this device (201). */
    signUp: (input: SignUpInput, o?: CallOptions) =>
      request<SessionResult>("/v1/store/auth/signup", {
        ...o,
        method: "POST",
        body: input,
      }),
    login: (input: LoginInput, o?: CallOptions) =>
      request<SessionResult>("/v1/store/auth/login", {
        ...o,
        method: "POST",
        body: input,
      }),
    /**
     * Emails a link to choose a new password. Answers 204 whether or not
     * the address has an account: nothing here says which.
     */
    forgotPassword: (
      input: { email: string; locale?: Locale },
      o?: CallOptions,
    ) =>
      request<void>("/v1/store/auth/password/forgot", {
        ...o,
        method: "POST",
        body: input,
      }),
    /**
     * Sets the new password with the token of the link and ends every
     * session of the customer (204). The customer signs in afterwards.
     */
    resetPassword: (
      input: { token: string; password: string },
      o?: CallOptions,
    ) =>
      request<void>("/v1/store/auth/password/reset", {
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

    // --- 7 Catalogue --------------------------------------------------------
    listCategories: (o?: CallOptions) =>
      request<{ items: Category[] }>("/v1/store/categories", o),
    getCategory: (slug: string, o?: CallOptions) =>
      request<{ category: CategoryDetail }>(
        `/v1/store/categories/${seg(slug)}`,
        o,
      ),
    listProducts: (query: ProductQuery = {}, o?: CallOptions) =>
      request<ProductList>("/v1/store/products", {
        ...o,
        query: { ...query },
      }),
    // The page, size, sort and view are left out: the counts are the same
    // for every page and view of a list, and so is the cached answer.
    getProductFacets: (query: ProductQuery = {}, o?: CallOptions) =>
      request<ProductFacets>("/v1/store/products/facets", {
        ...o,
        query: {
          ...query,
          page: undefined,
          limit: undefined,
          sort: undefined,
          view: undefined,
        },
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
    /** `variantId` is `variants[].id` of the chosen pack size (8). */
    setCartItem: (variantId: Id, quantity: number, o?: CallOptions) =>
      request<Bill>(`/v1/store/cart/items/${seg(variantId)}`, {
        ...o,
        method: "PUT",
        body: { quantity },
      }),
    removeCartItem: (variantId: Id, o?: CallOptions) =>
      request<Bill>(`/v1/store/cart/items/${seg(variantId)}`, {
        ...o,
        method: "DELETE",
      }),
    clearCart: (o?: CallOptions) =>
      request<Bill>("/v1/store/cart", { ...o, method: "DELETE" }),

    // --- 9 Orders and checkout ----------------------------------------------
    /**
     * Turns the stored cart into an order that waits for its payment and
     * answers the address of the payment page (9). The idempotency key is
     * made when the customer reaches the checkout and reused on every
     * retry: the same key answers the first order with its page.
     */
    checkout: (input: CheckoutInput, idempotencyKey: string, o?: CallOptions) =>
      request<CheckoutResult>("/v1/store/checkout", {
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
      input: { reason: CustomerCancellationReason; text?: string },
      o?: CallOptions,
    ) =>
      request<{ order: OrderDetail }>(
        `/v1/store/orders/${seg(orderNumber)}/cancel`,
        { ...o, method: "POST", body: input },
      ),

    // --- 10 Payments --------------------------------------------------------
    /**
     * The payment block and the documents of an order. Also the call after
     * the return from Stripe: the API asks Stripe about an open page first,
     * so the answer is right the moment the customer comes back (10.4).
     */
    getOrderPayment: (orderNumber: string, o?: CallOptions) =>
      request<OrderPayment>(`/v1/store/orders/${seg(orderNumber)}/payment`, o),
    /** A payment page for an order that still waits (10.3). */
    createPaymentPage: (orderNumber: string, o?: CallOptions) =>
      request<CheckoutSession>(`/v1/store/orders/${seg(orderNumber)}/pay`, {
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

    // --- 16 Wishlist --------------------------------------------------------
    /** A visitor's list, rendered; nothing is stored (16). */
    previewWishlist: (items: WishlistEntryInput[], o?: CallOptions) =>
      request<Wishlist>("/v1/store/wishlist/preview", {
        ...o,
        method: "POST",
        body: { items },
      }),
    getWishlist: (o?: CallOptions) =>
      request<Wishlist>("/v1/store/wishlist", o),
    /** Saves the product, or changes its remembered pack size. */
    saveWishlistItem: (productId: Id, variantId?: Id, o?: CallOptions) =>
      request<Wishlist>(`/v1/store/wishlist/items/${seg(productId)}`, {
        ...o,
        method: "PUT",
        body: variantId ? { variantId } : {},
      }),
    removeWishlistItem: (productId: Id, o?: CallOptions) =>
      request<Wishlist>(`/v1/store/wishlist/items/${seg(productId)}`, {
        ...o,
        method: "DELETE",
      }),
    clearWishlist: (o?: CallOptions) =>
      request<Wishlist>("/v1/store/wishlist", { ...o, method: "DELETE" }),
    /** The visitor's list, taken over once after sign-in or sign-up (16). */
    mergeWishlist: (items: WishlistEntryInput[], o?: CallOptions) =>
      request<Wishlist>("/v1/store/wishlist/merge", {
        ...o,
        method: "POST",
        body: { items },
      }),

    // --- 17 Homepage banners ------------------------------------------------
    /** The live banners in display order; an empty list means no carousel (17). */
    listBanners: (o?: CallOptions) =>
      request<{ banners: Banner[] }>("/v1/store/banners", o),
  };
}

export type StoreApi = ReturnType<typeof createStoreApi>;

/** Path of an invoice PDF, relative to the API base URL (needs the session). */
export function invoicePdfPath(number: string): string {
  return `/v1/store/invoices/${seg(number)}/pdf`;
}
