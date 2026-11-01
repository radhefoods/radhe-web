import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import { startMockApi } from "./testing.ts";

// Several named lists per customer (doc 16.2, CUSTOMER_ACCOUNTS 6), through
// the shop's API client.

const mock = startMockApi();

async function products() {
  const api = mock.guestApi();
  const rice = (await api.getProduct("basmati-rice-1kg")).product;
  const dal = (await api.listProducts({ q: "toor" })).items[0];
  return { rice, dal };
}

describe("several wishlists", () => {
  it("has one default list from the first look, named in the customer's language", async () => {
    const { api } = await mock.signIn("anna@example.com");
    const { items } = await api.listWishlists();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "My Favourites",
      isDefault: true,
      count: 0,
    });
    // The old routes address the default list and name it.
    const { rice } = await products();
    const list = await api.saveWishlistItem(rice.id);
    expect(list.wishlist).toMatchObject({ id: items[0].id, isDefault: true });
    expect(list.wishlist?.count).toBe(1);
    expect((await api.getWishlistById(items[0].id)).count).toBe(1);
  });

  it("creates, renames, makes default and deletes lists within the rules", async () => {
    const { api } = await mock.signIn("anna@example.com");
    const created = await api.createWishlist({ name: "Diwali" });
    expect(created.wishlist).toMatchObject({
      name: "Diwali",
      isDefault: false,
    });
    const taken = await api
      .createWishlist({ name: "  diwali " })
      .catch((e) => e);
    expect(hasErrorCode(taken, "WISHLIST_NAME_TAKEN")).toBe(true);
    const tooLong = await api
      .createWishlist({ name: "x".repeat(41) })
      .catch((e) => e);
    expect(hasErrorCode(tooLong, "VALIDATION_FAILED")).toBe(true);

    const renamed = await api.updateWishlist(created.wishlist.id, {
      name: "Diwali sweets",
      isDefault: true,
    });
    expect(renamed.wishlist).toMatchObject({
      name: "Diwali sweets",
      isDefault: true,
    });
    const lists = (await api.listWishlists()).items;
    expect(lists.map((list) => [list.name, list.isDefault])).toEqual([
      ["Diwali sweets", true],
      ["My Favourites", false],
    ]);
    // `false` is ignored: there is always one default.
    await api.updateWishlist(created.wishlist.id, { isDefault: false });
    expect((await api.getWishlist()).wishlist?.name).toBe("Diwali sweets");

    // Deleting the default makes the oldest remaining list the default.
    await api.deleteWishlist(created.wishlist.id);
    const left = (await api.listWishlists()).items;
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ name: "My Favourites", isDefault: true });
    const gone = await api.getWishlistById(created.wishlist.id).catch((e) => e);
    expect(hasErrorCode(gone, "WISHLIST_NOT_FOUND")).toBe(true);

    for (let i = 0; i < 19; i += 1) {
      await api.createWishlist({ name: `List ${i}` });
    }
    const limit = await api
      .createWishlist({ name: "One too many" })
      .catch((e) => e);
    expect(hasErrorCode(limit, "WISHLIST_LIMIT_REACHED")).toBe(true);
  });

  it("moves and copies a product between lists", async () => {
    const { api } = await mock.signIn("anna@example.com");
    const { rice, dal } = await products();
    const favourites = (await api.listWishlists()).items[0];
    const other = (await api.createWishlist({ name: "Weekend" })).wishlist;
    await api.saveWishlistItem(rice.id, rice.variantId);
    await api.saveWishlistItemTo(other.id, dal.id);

    const moved = await api.transferWishlistItem(favourites.id, rice.id, {
      to: other.id,
    });
    expect(moved.wishlist?.id).toBe(favourites.id);
    expect(moved.items).toEqual([]);
    const target = await api.getWishlistById(other.id);
    expect(target.items.map((item) => item.productId)).toEqual([
      rice.id,
      dal.id,
    ]);
    expect(target.items[0].variantId).toBe(rice.variantId);

    const copied = await api.transferWishlistItem(other.id, dal.id, {
      to: favourites.id,
      copy: true,
    });
    expect(copied.items.map((item) => item.productId)).toEqual([
      rice.id,
      dal.id,
    ]);
    expect((await api.getWishlist()).items.map((i) => i.productId)).toEqual([
      dal.id,
    ]);
    // Already there: stays as it is, nothing doubled.
    await api.transferWishlistItem(other.id, dal.id, {
      to: favourites.id,
      copy: true,
    });
    expect((await api.getWishlist()).count).toBe(1);

    const notOnList = await api
      .transferWishlistItem(favourites.id, rice.id, { to: other.id })
      .catch((e) => e);
    expect(hasErrorCode(notOnList, "PRODUCT_NOT_FOUND")).toBe(true);
    const noSuchList = await api
      .transferWishlistItem(other.id, rice.id, {
        to: "66fa00000000000000000099",
      })
      .catch((e) => e);
    expect(hasErrorCode(noSuchList, "WISHLIST_NOT_FOUND")).toBe(true);

    const emptied = await api.clearWishlistById(other.id);
    expect(emptied.items).toEqual([]);
    expect(
      (await api.removeWishlistItemFrom(favourites.id, dal.id)).count,
    ).toBe(0);
    const overview = await api.getOverview();
    expect(overview.counts).toMatchObject({ wishlists: 2, wishlistItems: 0 });
  });
});
