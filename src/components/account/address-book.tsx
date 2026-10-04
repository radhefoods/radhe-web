"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AddressForm } from "@/components/checkout/address-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addressToFormValues,
  toAddressInput,
  type AddressFormValues,
} from "@/features/checkout/address-schema";
import { ADDRESSES_QUERY_KEY } from "@/features/orders/orders";
import { api } from "@/lib/api/browser";
import type { Address, AddressList, Id } from "@/lib/api/types";
import { AddressBlock } from "./order-bits";

const ADDRESS_LIMIT = 10;

/** The delivery addresses of the customer: add, change, delete, choose the standard. */
export function AddressBook() {
  const t = useTranslations("addressBook");
  const tAddress = useTranslations("address");
  const tAccount = useTranslations("account");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ADDRESSES_QUERY_KEY,
    queryFn: () => api.listAddresses(),
  });
  const [editing, setEditing] = useState<Id | "new" | null>(null);
  const [busy, setBusy] = useState<Id | null>(null);
  const [error, setError] = useState<unknown>(null);
  const addresses = query.data?.items;

  // Every address endpoint answers with the full list.
  const store = (list: AddressList) =>
    client.setQueryData(ADDRESSES_QUERY_KEY, list);

  async function save(values: AddressFormValues) {
    const input = toAddressInput(values);
    store(
      editing && editing !== "new"
        ? await api.updateAddress(editing, input)
        : await api.createAddress(input),
    );
    setEditing(null);
  }

  async function act(id: Id, action: () => Promise<AddressList>) {
    setBusy(id);
    setError(null);
    try {
      store(await action());
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(null);
    }
  }

  const nameOf = (address: Address) =>
    `${address.firstName} ${address.lastName}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-ink-muted">{t("intro")}</p>
      </header>

      {query.error && !addresses ? (
        <ErrorAlert
          error={query.error}
          title={tAccount("loadError")}
          onRetry={() => void query.refetch()}
        />
      ) : !addresses ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : (
        <>
          {error !== null && <ErrorAlert error={error} />}
          {addresses.length === 0 && editing === null && (
            <p className="bg-mist text-ink-muted rounded-xl px-6 py-10 text-center">
              {t("empty")}
            </p>
          )}

          <ul className="grid gap-3 md:grid-cols-2">
            {addresses.map((address) =>
              editing === address.id ? (
                <li
                  key={address.id}
                  className="border-line rounded-lg border p-4 md:col-span-2"
                >
                  <AddressForm
                    idPrefix={`address-${address.id}`}
                    initial={addressToFormValues(address)}
                    showDefault={!address.isDefault}
                    onSave={save}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : (
                <li
                  key={address.id}
                  className="border-line flex flex-col gap-3 rounded-lg border bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3 text-[0.9375rem]">
                    <AddressBlock address={address} />
                    {address.isDefault && (
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                        {tAddress("default")}
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={tAddress("editNamed", {
                        name: nameOf(address),
                      })}
                      onClick={() => setEditing(address.id)}
                    >
                      {tAddress("edit")}
                    </Button>
                    {!address.isDefault && (
                      <Button
                        variant="quiet"
                        size="sm"
                        loading={busy === address.id}
                        aria-label={t("makeDefaultNamed", {
                          name: nameOf(address),
                        })}
                        onClick={() =>
                          void act(address.id, () =>
                            api.setDefaultAddress(address.id),
                          )
                        }
                      >
                        {t("makeDefault")}
                      </Button>
                    )}
                    <Button
                      variant="quiet"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      disabled={busy === address.id}
                      aria-label={t("deleteNamed", { name: nameOf(address) })}
                      onClick={() =>
                        void act(address.id, () =>
                          api.deleteAddress(address.id),
                        )
                      }
                    >
                      {t("delete")}
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>

          {editing === "new" ? (
            <div className="border-line rounded-lg border p-4">
              <AddressForm
                idPrefix="address-new"
                showDefault={addresses.length > 0}
                onSave={save}
                onCancel={() => setEditing(null)}
              />
            </div>
          ) : addresses.length >= ADDRESS_LIMIT ? (
            <Alert tone="info">{t("limit")}</Alert>
          ) : (
            editing === null && (
              <Button
                variant="secondary"
                className="self-start"
                onClick={() => setEditing("new")}
              >
                <Plus aria-hidden="true" className="size-5" />
                {tAddress("add")}
              </Button>
            )
          )}
        </>
      )}
    </div>
  );
}
