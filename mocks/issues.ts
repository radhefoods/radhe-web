// Problem reports after a delivery (doc 23, CUSTOMER_ACCOUNTS 9) in the
// mock API: what can be reported, the report with its items, problems,
// text and photos, what the customer may still do with it, and the
// admin's decisions as test controls.

import { randomBytes } from "node:crypto";
import type {
  Issue,
  IssueProblem,
  IssueResolutionType,
  OrderIssues,
} from "../src/lib/api/types.ts";
import {
  HttpError,
  OBJECT_ID,
  objectBody,
  validationFailed,
} from "./errors.ts";
import type { MultipartFile } from "./multipart.ts";
import { ordersOf } from "./orders.ts";
import {
  db,
  settings,
  type CustomerRecord,
  type IssueRecord,
  type Locale,
  type OrderRecord,
} from "./state.ts";
import { getMediaBase, packSizeOf } from "./views.ts";

const PROBLEMS: IssueProblem[] = [
  "damaged",
  "missing",
  "wrong_item",
  "not_fresh",
  "late",
  "other",
];
const RESOLUTIONS: IssueResolutionType[] = ["refund", "replacement", "none"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGES_MAX = 5;
const REPORTS_PER_ORDER = 5;
const DAY = 86_400_000;

function issuesOfOrder(order: OrderRecord): IssueRecord[] {
  return [...db.issues.values()].filter(
    (issue) => issue.orderNumber === order.orderNumber,
  );
}

/** The window of an order: delivered, within the days, fewer than five reports. */
function windowOf(order: OrderRecord): OrderIssues["window"] {
  const days = settings.returns.issueWindowDays;
  const deliveredAt = order.delivery.deliveredAt;
  if (!deliveredAt || days <= 0) return { possible: false, until: null };
  const until = new Date(Date.parse(deliveredAt) + days * DAY).toISOString();
  const open = Date.parse(until) > Date.now();
  return {
    possible: open && issuesOfOrder(order).length < REPORTS_PER_ORDER,
    until,
  };
}

function reportableOf(order: OrderRecord): OrderIssues["reportable"] {
  if (!order.delivery.deliveredAt) return [];
  return order.items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    sku: item.sku,
    available: Math.max(0, item.deliveredQuantity - item.returnedQuantity),
  }));
}

/** The report as the customer sees it (doc 23). */
export function issueView(issue: IssueRecord, locale: Locale): Issue {
  const mediaBase = getMediaBase();
  return {
    issueNumber: issue.issueNumber,
    orderNumber: issue.orderNumber,
    status: issue.status,
    reportedAt: issue.reportedAt,
    decidedAt: issue.decidedAt,
    items: issue.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      sku: item.sku,
      name: item.name[locale] || item.name.en,
      packSize: packSizeOf(item.packValue, item.packUnit, locale),
      quantity: item.quantity,
      refundedQuantity: item.refundedQuantity,
      unitPrice: item.unitPrice,
    })),
    problems: issue.problems,
    description: issue.description,
    images: issue.imageIds.map((id) => {
      const url = `${mediaBase}/media/issues/${id}`;
      const size = { url, width: 800, height: 800 };
      return { id, url, sizes: { small: size, medium: size, large: size } };
    }),
    preferredResolution: issue.preferredResolution,
    resolution: issue.resolution,
    history: issue.history,
    canCancel: issue.status === "open",
    canAddImages:
      (issue.status === "open" || issue.status === "in_review") &&
      issue.imageIds.length < IMAGES_MAX,
  };
}

export function orderIssues(order: OrderRecord, locale: Locale): OrderIssues {
  return {
    items: issuesOfOrder(order)
      .sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt))
      .map((issue) => issueView(issue, locale)),
    window: windowOf(order),
    reportable: reportableOf(order),
  };
}

export function findIssue(customer: CustomerRecord, issueNumber: string) {
  const issue = db.issues.get(issueNumber.toUpperCase());
  if (!issue || issue.customerId !== customer.id) {
    throw new HttpError(404, "ISSUE_NOT_FOUND", "This report does not exist.");
  }
  return issue;
}

export function listIssues(customer: CustomerRecord, locale: Locale) {
  return {
    items: [...db.issues.values()]
      .filter((issue) => issue.customerId === customer.id)
      .sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt))
      .map((issue) => issueView(issue, locale)),
  };
}

/** `POST /v1/store/orders/{orderNumber}/issues` */
export function createIssue(
  customer: CustomerRecord,
  order: OrderRecord,
  raw: unknown,
  locale: Locale,
): Issue {
  const body = objectBody(raw, [
    "items",
    "problems",
    "description",
    "preferredResolution",
    "locale",
  ]);
  if (
    !Array.isArray(body.problems) ||
    body.problems.length === 0 ||
    body.problems.some((p) => !PROBLEMS.includes(p as IssueProblem))
  ) {
    throw validationFailed(
      "problems",
      `problems must be one or more of: ${PROBLEMS.join(", ")}`,
    );
  }
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (description.length < 10 || description.length > 2000) {
    throw validationFailed(
      "description",
      "description must be 10 to 2000 characters",
    );
  }
  if (!RESOLUTIONS.includes(body.preferredResolution as IssueResolutionType)) {
    throw validationFailed(
      "preferredResolution",
      `preferredResolution must be one of: ${RESOLUTIONS.join(", ")}`,
    );
  }
  const wanted: { variantId: string; quantity: number }[] = [];
  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) {
      throw validationFailed("items", "items must be a list");
    }
    body.items.forEach((entry, index) => {
      const item = objectBody(entry, ["variantId", "quantity"]);
      if (
        typeof item.variantId !== "string" ||
        !OBJECT_ID.test(item.variantId)
      ) {
        throw validationFailed(
          `items.${index}.variantId`,
          "variantId must be an id",
        );
      }
      if (
        typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        throw validationFailed(
          `items.${index}.quantity`,
          "quantity must be at least 1",
        );
      }
      wanted.push({ variantId: item.variantId, quantity: item.quantity });
    });
  }

  const window = windowOf(order);
  if (
    !order.delivery.deliveredAt ||
    issuesOfOrder(order).length >= REPORTS_PER_ORDER
  ) {
    throw new HttpError(
      409,
      "ISSUE_NOT_POSSIBLE",
      "A problem can be reported for a delivered order, up to five times.",
    );
  }
  if (!window.possible) {
    throw new HttpError(
      409,
      "ISSUE_WINDOW_CLOSED",
      "The time for reporting a problem has passed.",
      { until: window.until, windowDays: settings.returns.issueWindowDays },
    );
  }
  const reportable = reportableOf(order);
  const items = wanted.map((entry) => {
    const item = order.items.find(
      (candidate) => candidate.variantId === entry.variantId,
    );
    const row = reportable.find(
      (candidate) => candidate.variantId === entry.variantId,
    );
    if (!item || !row) {
      throw new HttpError(
        400,
        "ORDER_ITEM_NOT_FOUND",
        "This product is not part of the order.",
        { variantId: entry.variantId },
      );
    }
    if (entry.quantity > row.available) {
      throw new HttpError(
        409,
        "ISSUE_QUANTITY_INVALID",
        "More than was delivered and kept.",
        { variantId: entry.variantId, sku: item.sku, available: row.available },
      );
    }
    return {
      productId: item.productId,
      variantId: item.variantId,
      sku: item.sku,
      name: item.name,
      packValue: item.packValue,
      packUnit: item.packUnit,
      quantity: entry.quantity,
      refundedQuantity: 0,
      unitPrice: item.unitPrice,
    };
  });
  const now = new Date().toISOString();
  const issue: IssueRecord = {
    issueNumber: `${order.orderNumber}-P${issuesOfOrder(order).length + 1}`,
    orderNumber: order.orderNumber,
    customerId: customer.id,
    status: "open",
    reportedAt: now,
    decidedAt: null,
    items,
    problems: body.problems as IssueProblem[],
    description,
    imageIds: [],
    preferredResolution: body.preferredResolution as IssueResolutionType,
    resolution: null,
    history: [{ status: "open", at: now, by: "customer", note: null }],
    locale: (body.locale as Locale | undefined) ?? locale,
  };
  db.issues.set(issue.issueNumber, issue);
  console.log(
    `[mock] problem report received email to ${customer.email}: ${issue.issueNumber}`,
  );
  return issueView(issue, locale);
}

/** `POST /v1/store/issues/{issueNumber}/images`: JPEG, PNG or WebP, five in all. */
export function addIssueImages(
  issue: IssueRecord,
  files: MultipartFile[],
  locale: Locale,
): Issue {
  if (issue.status !== "open" && issue.status !== "in_review") {
    throw new HttpError(
      409,
      "ISSUE_TRANSITION_NOT_ALLOWED",
      "Photos can no longer be added to this report.",
    );
  }
  const photos = files.filter((file) => file.field === "files");
  if (photos.length === 0) {
    throw validationFailed("files", "files must hold at least one picture");
  }
  if (
    photos.some(
      (file) => !IMAGE_TYPES.includes(file.type) || file.data.length === 0,
    )
  ) {
    throw new HttpError(
      400,
      "IMAGE_INVALID",
      "Only JPEG, PNG and WebP pictures.",
    );
  }
  if (issue.imageIds.length + photos.length > IMAGES_MAX) {
    throw new HttpError(
      400,
      "IMAGE_LIMIT_REACHED",
      "A report can have up to five photos.",
      { maximum: IMAGES_MAX },
    );
  }
  for (const file of photos) {
    const id = `66fc${randomBytes(10).toString("hex")}`;
    db.issueImages.set(id, { type: file.type, data: file.data });
    issue.imageIds.push(id);
  }
  return issueView(issue, locale);
}

export function removeIssueImage(
  issue: IssueRecord,
  imageId: string,
  locale: Locale,
): Issue {
  if (!issue.imageIds.includes(imageId)) {
    throw new HttpError(404, "NOT_FOUND", "No such photo on this report.");
  }
  issue.imageIds = issue.imageIds.filter((id) => id !== imageId);
  db.issueImages.delete(imageId);
  return issueView(issue, locale);
}

export function cancelIssue(issue: IssueRecord, locale: Locale): Issue {
  if (issue.status !== "open") {
    throw new HttpError(
      409,
      "ISSUE_TRANSITION_NOT_ALLOWED",
      "Radhe Foods is already looking at this report.",
      { from: issue.status, to: "cancelled" },
    );
  }
  const now = new Date().toISOString();
  issue.status = "cancelled";
  issue.decidedAt = now;
  issue.history.push({
    status: "cancelled",
    at: now,
    by: "customer",
    note: null,
  });
  return issueView(issue, locale);
}

/** The admin's decision, as a test control (`POST /__mock/issue`). */
export function decideIssue(issue: IssueRecord, raw: unknown): void {
  const body = objectBody(raw, [
    "issueNumber",
    "action",
    "note",
    "resolution",
    "amount",
  ]);
  const now = new Date().toISOString();
  const note = typeof body.note === "string" ? body.note : null;
  switch (body.action) {
    case "review":
      issue.status = "in_review";
      issue.history.push({ status: "in_review", at: now, by: "admin", note });
      break;
    case "resolve": {
      const type =
        (body.resolution as IssueResolutionType | undefined) ??
        issue.preferredResolution;
      let amount = typeof body.amount === "number" ? body.amount : 0;
      if (type === "refund") {
        amount =
          typeof body.amount === "number"
            ? body.amount
            : issue.items.reduce(
                (sum, item) => sum + item.quantity * item.unitPrice,
                0,
              );
        // The order's delivered quantities are corrected (doc 23).
        const order = db.orders.get(issue.orderNumber);
        for (const item of issue.items) {
          item.refundedQuantity = item.quantity;
          const line = order?.items.find(
            (candidate) => candidate.variantId === item.variantId,
          );
          if (order && line) {
            const from = line.deliveredQuantity;
            line.deliveredQuantity = Math.max(0, from - item.quantity);
            order.adjustments.push({
              productId: line.productId,
              variantId: line.variantId,
              sku: line.sku,
              from,
              to: line.deliveredQuantity,
              reason: issue.problems.includes("missing")
                ? "missing"
                : issue.problems.includes("wrong_item")
                  ? "wrong_item"
                  : issue.problems.includes("damaged")
                    ? "damaged"
                    : "customer_complaint",
              at: now,
            });
          }
        }
      }
      issue.status = "resolved";
      issue.decidedAt = now;
      issue.resolution = { type, amount, note, at: now };
      issue.history.push({ status: "resolved", at: now, by: "admin", note });
      break;
    }
    case "reject":
      issue.status = "rejected";
      issue.decidedAt = now;
      issue.history.push({
        status: "rejected",
        at: now,
        by: "admin",
        note: note ?? "Rejected.",
      });
      break;
    default:
      throw validationFailed(
        "action",
        "action must be review, resolve or reject",
      );
  }
}

/** The customer's reports that are still open: nobody decided yet. */
export function openIssuesOf(customer: CustomerRecord): IssueRecord[] {
  return [...db.issues.values()].filter(
    (issue) =>
      issue.customerId === customer.id &&
      (issue.status === "open" || issue.status === "in_review"),
  );
}

/** For the delivered orders of a customer: nothing else is needed yet. */
export function deliveredOrdersOf(customer: CustomerRecord): OrderRecord[] {
  return ordersOf(customer).filter(
    (order) => order.delivery.deliveredAt !== null,
  );
}
