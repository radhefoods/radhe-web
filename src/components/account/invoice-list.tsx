"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { INVOICES_QUERY_KEY } from "@/features/orders/orders";
import { api } from "@/lib/api/browser";
import { DocumentRow } from "./order-bits";

/** Every invoice and credit note of the customer, newest first, with its PDF. */
export function InvoiceList() {
  const t = useTranslations("documents");
  const tAccount = useTranslations("account");
  const query = useInfiniteQuery({
    queryKey: INVOICES_QUERY_KEY,
    queryFn: ({ pageParam }) =>
      api.listInvoices({ limit: 25, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    staleTime: 0,
  });
  const documents = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
        {t("title")}
      </h1>
      {query.error && documents.length === 0 ? (
        <ErrorAlert
          error={query.error}
          title={tAccount("loadError")}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      ) : documents.length === 0 ? (
        <p className="bg-mist text-ink-muted rounded-xl px-6 py-10 text-center">
          {t("empty")}
        </p>
      ) : (
        <>
          <ul className="border-line rounded-xl border bg-white px-5">
            {documents.map((document) => (
              <DocumentRow key={document.id} document={document} showOrder />
            ))}
          </ul>
          {query.hasNextPage && (
            <Button
              variant="secondary"
              className="self-center"
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t("loadMore")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
