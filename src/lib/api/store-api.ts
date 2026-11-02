import type { Locale } from "@/i18n/routing";
import type { RequestOptions, Requester } from "./http";
import type {
  AccountOverview,
  Address,
  AddressInput,
  AddressList,
  Banner,
  Bill,
  BlogCategory,
  BlogPost,
  BlogPostSummary,
  BlogQuery,
  BlogTag,
  CartItemInput,
  CartPreviewInput,
  Category,
  CategoryDetail,
  CheckoutInput,
  CheckoutResult,
  CheckoutSession,
  Communication,
  CreateIssueInput,
  CreateReturnInput,
  CursorPage,
  Customer,
  CustomerCancellationReason,
  DeleteAccountInput,
  Faqs,
  GuestCheckoutInput,
  GuestCheckoutResult,
  GuestOrder,
  Id,
  InvoiceDetail,
  InvoiceSummary,
  Issue,
  LegalDocument,
  LegalSummary,
  LegalType,
  LoginInput,
  MyReview,
  MyRewards,
  OrderDetail,
  OrderReviewState,
  OrderIssues,
  OrderPayment,
  OrderReturns,
  OrderSummary,
  Page,
  ProductDetail,
  ProductFacets,
  ProductList,
  ProductQuery,
  Referral,
  ReferralCodeCheck,
  ReturnRequest,
  RewardsProgram,
  RewardTransaction,
  ReviewPage,
  ReviewQuery,
  SessionResult,
  ShopSettings,
  SignUpInput,
  SignUpStarted,
  SignUpVerified,
  SignUpVerifyInput,
  UnsubscribeResult,
  UpdateCommunicationInput,
  UpdateProfileInput,
  Wishlist,
  WishlistEntryInput,
  WishlistInput,
  WishlistSummary,
  WishlistTransferInput,
  WriteReviewInput,
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
  /**
   * The routes added on 2026-11-01 refuse `?locale=` (their validation
   * lists no such field): the language goes as `Accept-Language` (0.6).
   */
  const localized: Requester = (path, options) =>
    request(path, { ...options, localeAs: "header" });
  return {
    // --- 1 Authentication ---------------------------------------------------
    /**
     * Starts the sign-up: a code is emailed (202, `SignUpStarted`) and
     * `signUpVerify` makes the account. An API older than 2026-11-01
     * created the account at once (201, `SessionResult`): the form tells
     * the two apart by `customer` in the answer.
     */
    signUp: (input: SignUpInput, o?: CallOptions) =>
      request<SignUpStarted | SessionResult>("/v1/store/auth/signup", {
        ...o,
        method: "POST",
        body: input,
      }),
    /** Finishes the sign-up with the code: the account, signed in (201). */
    signUpVerify: (input: SignUpVerifyInput, o?: CallOptions) =>
      localized<SignUpVerified>("/v1/store/auth/signup/verify", {
        ...o,
        method: "POST",
        body: input,
      }),
    /** A new code for a sign-up that waits (204, whatever happened). */
    signUpResend: (input: { email: string }, o?: CallOptions) =>
      localized<void>("/v1/store/auth/signup/resend", {
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
    /** The account at a glance: counts, the standard address, the referral code (2). */
    getOverview: (o?: CallOptions) =>
      localized<AccountOverview>("/v1/store/me/overview", o),
    /** Closes the account for good (204, cookies cleared). */
    deleteAccount: (input: DeleteAccountInput, o?: CallOptions) =>
      localized<void>("/v1/store/me/delete", {
        ...o,
        method: "POST",
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
    /** A visitor's cart priced; with `discountCode` the bill carries the discount (20). */
    previewCart: (
      items: CartItemInput[],
      o?: CallOptions & { discountCode?: string },
    ) => {
      const { discountCode, ...rest } = o ?? {};
      const body: CartPreviewInput = discountCode
        ? { items, discountCode }
        : { items };
      return request<Bill>("/v1/store/cart/preview", {
        ...rest,
        method: "POST",
        body,
      });
    },
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

    // --- 9.6 Discount codes on the checkout page ----------------------------
    /**
     * Keeps a code with the cart and answers the bill with the discount; a
     * code applied before is replaced. `400 DISCOUNT_NOT_APPLICABLE` names
     * the reason. The code travels as typed; the API upper-cases it.
     */
    applyDiscount: (code: string, o?: CallOptions) =>
      request<Bill>("/v1/store/checkout/discount", {
        ...o,
        method: "PUT",
        body: { code },
      }),
    /** Removes the code; answers the bill without it. */
    removeDiscount: (o?: CallOptions) =>
      request<Bill>("/v1/store/checkout/discount", {
        ...o,
        method: "DELETE",
      }),

    // --- 24 Points and rewards (doc/REWARDS.md 5) ---------------------------
    /** The rules of the coins, for everyone; `404` on an API without them. */
    getRewardsProgram: (o?: CallOptions) =>
      localized<{ program: RewardsProgram }>("/v1/store/rewards/program", o),
    /** The customer's coins: balance, totals, the rules, whether redeeming is offered. */
    getMyRewards: (o?: CallOptions) =>
      localized<MyRewards>("/v1/store/me/rewards", o),
    /** The history of the coins, newest first, by page. */
    listRewardTransactions: (
      query: { page?: number; limit?: number } = {},
      o?: CallOptions,
    ) =>
      localized<Page<RewardTransaction>>("/v1/store/me/rewards/transactions", {
        ...o,
        query,
      }),
    /**
     * Keeps a number of coins with the cart and answers the bill with them
     * priced in; without `coins`, as many as the rules allow. `400
     * REWARDS_NOT_APPLICABLE` names the reason. 30 calls a minute.
     */
    redeemCoins: (coins?: number, o?: CallOptions) =>
      localized<Bill>("/v1/store/checkout/rewards", {
        ...o,
        method: "PUT",
        body: coins === undefined ? {} : { coins },
      }),
    /** Takes the coins off the cart; answers the bill without them. */
    removeCoins: (o?: CallOptions) =>
      localized<Bill>("/v1/store/checkout/rewards", { ...o, method: "DELETE" }),

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

    // --- 20 Guest checkout --------------------------------------------------
    /**
     * An order without an account, from the browser's cart (20): answers
     * the order, its payment page and the token that opens the order
     * afterwards. The idempotency key as for the account checkout.
     */
    guestCheckout: (
      input: GuestCheckoutInput,
      idempotencyKey: string,
      o?: CallOptions,
    ) =>
      localized<GuestCheckoutResult>("/v1/store/guest/checkout", {
        ...o,
        method: "POST",
        body: input,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    /**
     * The guest order, its payment and documents; asks Stripe about an
     * open page first. The token travels in the query: the API's CORS
     * allows no header for it (0.5).
     */
    getGuestOrder: (orderNumber: string, token: string, o?: CallOptions) =>
      localized<GuestOrder>(`/v1/store/guest/orders/${seg(orderNumber)}`, {
        ...o,
        query: { token },
      }),
    /** A payment page for a guest order that still waits. */
    payGuestOrder: (orderNumber: string, token: string, o?: CallOptions) =>
      localized<CheckoutSession>(
        `/v1/store/guest/orders/${seg(orderNumber)}/pay`,
        { ...o, method: "POST", query: { token } },
      ),
    cancelGuestOrder: (
      orderNumber: string,
      token: string,
      input: { reason: CustomerCancellationReason; text?: string },
      o?: CallOptions,
    ) =>
      localized<{ order: OrderDetail }>(
        `/v1/store/guest/orders/${seg(orderNumber)}/cancel`,
        { ...o, method: "POST", body: input, query: { token } },
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

    // --- 16.2 Several named lists -------------------------------------------
    /** Every list of the customer, the default first. */
    listWishlists: (o?: CallOptions) =>
      localized<{ items: WishlistSummary[] }>("/v1/store/wishlists", o),
    createWishlist: (
      input: WishlistInput & { name: string },
      o?: CallOptions,
    ) =>
      localized<{ wishlist: WishlistSummary }>("/v1/store/wishlists", {
        ...o,
        method: "POST",
        body: input,
      }),
    getWishlistById: (id: Id, o?: CallOptions) =>
      localized<Wishlist>(`/v1/store/wishlists/${seg(id)}`, o),
    /** Renames the list, or makes it the default. */
    updateWishlist: (id: Id, input: WishlistInput, o?: CallOptions) =>
      localized<{ wishlist: WishlistSummary }>(
        `/v1/store/wishlists/${seg(id)}`,
        {
          ...o,
          method: "PATCH",
          body: input,
        },
      ),
    deleteWishlist: (id: Id, o?: CallOptions) =>
      localized<void>(`/v1/store/wishlists/${seg(id)}`, {
        ...o,
        method: "DELETE",
      }),
    saveWishlistItemTo: (
      id: Id,
      productId: Id,
      variantId?: Id,
      o?: CallOptions,
    ) =>
      localized<Wishlist>(
        `/v1/store/wishlists/${seg(id)}/items/${seg(productId)}`,
        { ...o, method: "PUT", body: variantId ? { variantId } : {} },
      ),
    removeWishlistItemFrom: (id: Id, productId: Id, o?: CallOptions) =>
      localized<Wishlist>(
        `/v1/store/wishlists/${seg(id)}/items/${seg(productId)}`,
        { ...o, method: "DELETE" },
      ),
    /** Moves the product to another list, or copies it; answers this list afterwards. */
    transferWishlistItem: (
      id: Id,
      productId: Id,
      input: WishlistTransferInput,
      o?: CallOptions,
    ) =>
      localized<Wishlist>(
        `/v1/store/wishlists/${seg(id)}/items/${seg(productId)}/transfer`,
        { ...o, method: "POST", body: input },
      ),
    clearWishlistById: (id: Id, o?: CallOptions) =>
      localized<Wishlist>(`/v1/store/wishlists/${seg(id)}/items`, {
        ...o,
        method: "DELETE",
      }),

    // --- 21 Referrals ---------------------------------------------------------
    /** The code, the link and the people who used it. */
    getReferral: (o?: CallOptions) =>
      localized<{ referral: Referral }>("/v1/store/me/referral", o),
    /**
     * Whether a code belongs to an active account, and the first name of
     * the person who invites with it; no session, 10 calls a minute per
     * address. `404 REFERRAL_CODE_UNKNOWN` for any other code.
     */
    checkReferralCode: (code: string, o?: CallOptions) =>
      localized<ReferralCodeCheck>(
        `/v1/store/referral-codes/${seg(code.trim().toUpperCase())}`,
        o,
      ),

    // --- Order reviews (doc ORDER_REVIEWS) ------------------------------------
    /** The published reviews of delivered orders, newest first, with the summary. */
    listReviews: (query: ReviewQuery = {}, o?: CallOptions) =>
      localized<ReviewPage>("/v1/store/reviews", { ...o, query: { ...query } }),
    /** The customer's review of an order, and whether one can be written. */
    getOrderReview: (orderNumber: string, o?: CallOptions) =>
      localized<OrderReviewState>(
        `/v1/store/orders/${seg(orderNumber)}/review`,
        o,
      ),
    /** Writes the one review of a delivered order; it waits for approval. */
    writeOrderReview: (
      orderNumber: string,
      input: WriteReviewInput,
      o?: CallOptions,
    ) =>
      localized<{ review: MyReview }>(
        `/v1/store/orders/${seg(orderNumber)}/review`,
        { ...o, method: "POST", body: input },
      ),
    /** The customer's own reviews, newest first, whatever their status. */
    listMyReviews: (o?: CallOptions) =>
      localized<{ items: MyReview[] }>("/v1/store/me/reviews", o),
    /** The delivered orders without a review, newest delivery first. */
    listReviewable: (o?: CallOptions) =>
      localized<{ items: OrderSummary[] }>(
        "/v1/store/me/reviews/reviewable",
        o,
      ),

    // --- 23 Problem reports ---------------------------------------------------
    /** The reports of an order, the window, and what can be named (23). */
    getOrderIssues: (orderNumber: string, o?: CallOptions) =>
      localized<OrderIssues>(`/v1/store/orders/${seg(orderNumber)}/issues`, o),
    createIssue: (
      orderNumber: string,
      input: CreateIssueInput,
      o?: CallOptions,
    ) =>
      localized<{ issue: Issue }>(
        `/v1/store/orders/${seg(orderNumber)}/issues`,
        {
          ...o,
          method: "POST",
          body: input,
        },
      ),
    /** Up to five photos per report in all, JPEG, PNG or WebP. */
    uploadIssueImages: (
      issueNumber: string,
      files: File[],
      o?: CallOptions,
    ) => {
      const formData = new FormData();
      for (const file of files) formData.append("files", file, file.name);
      return localized<{ issue: Issue }>(
        `/v1/store/issues/${seg(issueNumber)}/images`,
        { ...o, method: "POST", formData },
      );
    },
    deleteIssueImage: (issueNumber: string, imageId: Id, o?: CallOptions) =>
      localized<{ issue: Issue }>(
        `/v1/store/issues/${seg(issueNumber)}/images/${seg(imageId)}`,
        { ...o, method: "DELETE" },
      ),
    /** The customer's reports, newest first. */
    listIssues: (o?: CallOptions) =>
      localized<{ items: Issue[] }>("/v1/store/issues", o),
    getIssue: (issueNumber: string, o?: CallOptions) =>
      localized<{ issue: Issue }>(`/v1/store/issues/${seg(issueNumber)}`, o),
    /** Takes the report back while nobody looked at it. */
    cancelIssue: (issueNumber: string, o?: CallOptions) =>
      localized<{ issue: Issue }>(
        `/v1/store/issues/${seg(issueNumber)}/cancel`,
        {
          ...o,
          method: "POST",
        },
      ),

    // --- 17 Homepage banners ------------------------------------------------
    /** The live banners in display order; an empty list means no carousel (17). */
    listBanners: (o?: CallOptions) =>
      request<{ banners: Banner[] }>("/v1/store/banners", o),

    // --- 18 FAQ ---------------------------------------------------------------
    /** The published questions under their headings; `groups: []` means none (18). */
    listFaqs: (o?: CallOptions) => request<Faqs>("/v1/store/faqs", o),

    // --- 19 Blog --------------------------------------------------------------
    /** Published posts whose date has come, newest first, without their texts (19). */
    listBlogPosts: (query: BlogQuery = {}, o?: CallOptions) =>
      request<Page<BlogPostSummary>>("/v1/store/blog/posts", {
        ...o,
        query: { ...query },
      }),
    /** By the slug of either language; 404 for drafts and scheduled posts. */
    getBlogPost: (slug: string, o?: CallOptions) =>
      request<{ post: BlogPost }>(`/v1/store/blog/posts/${seg(slug)}`, o),
    listBlogCategories: (o?: CallOptions) =>
      request<{ items: BlogCategory[] }>("/v1/store/blog/categories", o),
    /** The tags of the published posts, most used first. */
    listBlogTags: (o?: CallOptions) =>
      request<{ items: BlogTag[] }>("/v1/store/blog/tags", o),
  };
}

export type StoreApi = ReturnType<typeof createStoreApi>;

/** Path of an invoice PDF, relative to the API base URL (needs the session). */
export function invoicePdfPath(number: string): string {
  return `/v1/store/invoices/${seg(number)}/pdf`;
}

/** Path of a guest order's invoice PDF, with the token that opens the order (20). */
export function guestInvoicePdfPath(
  orderNumber: string,
  number: string,
  token: string,
): string {
  return `/v1/store/guest/orders/${seg(orderNumber)}/invoices/${seg(number)}/pdf?token=${seg(token)}`;
}
