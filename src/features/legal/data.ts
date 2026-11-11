import { cache } from "react";
import type { Locale } from "@/i18n/routing";
import { hasErrorCode } from "@/lib/api/errors";
import {
  REVALIDATE,
  TAGS,
  leaveToFirstVisitWhileBuilding,
  serverApi,
} from "@/lib/api/server";
import type { LegalDocument, LegalSummary, LegalType } from "@/lib/api/types";

// The legal pages as the server reads them from the API (doc 6): cached by
// Next.js for a few minutes and shared by the components of one request.

const legal = { revalidate: REVALIDATE.legal, tags: [TAGS.legal] };

/**
 * The legal pages that are published, for the frame of the shop: `null`
 * when the API did not answer, because the footer must never take a page
 * down. Read in one language for both: the footer needs to know which
 * pages exist and names them itself.
 */
export const getPublishedLegal = cache(
  async (): Promise<LegalSummary[] | null> => {
    try {
      const { items } = await serverApi.listLegal({
        locale: "en",
        next: legal,
      });
      return items;
    } catch {
      return null;
    }
  },
);

/**
 * One legal page in the version that applies now; `null` when the admin
 * has published none. An API older than 2026-11-11 knows `terms` and
 * `privacy` only and answers `400 BAD_REQUEST` to the other four types:
 * for the shop that is a page without a published text as well.
 */
export const getLegalDocument = cache(
  async (type: LegalType, locale: Locale): Promise<LegalDocument | null> => {
    try {
      const { document } = await serverApi.getLegal(type, {
        locale,
        next: legal,
      });
      return document;
    } catch (error) {
      if (
        hasErrorCode(error, "LEGAL_DOCUMENT_NOT_FOUND") ||
        hasErrorCode(error, "BAD_REQUEST")
      ) {
        return null;
      }
      await leaveToFirstVisitWhileBuilding();
      throw error;
    }
  },
);
