import { describe, expect, it } from "vitest";
import { isSafePaymentUrl } from "./payment-url";

describe("isSafePaymentUrl", () => {
  it("accepts secure addresses", () => {
    expect(
      isSafePaymentUrl("https://checkout.stripe.com/c/pay/cs_test_1"),
    ).toBe(true);
  });

  it("accepts plain http on the local machine only", () => {
    expect(isSafePaymentUrl("http://localhost:3000/__mock/stripe/RF-1")).toBe(
      true,
    );
    expect(isSafePaymentUrl("http://127.0.0.1:3000/pay")).toBe(true);
    expect(isSafePaymentUrl("http://checkout.stripe.com/pay")).toBe(false);
    expect(isSafePaymentUrl("http://localhost.evil.example/pay")).toBe(false);
  });

  it("refuses everything that is not a web address", () => {
    expect(isSafePaymentUrl("javascript:alert(1)")).toBe(false);
    expect(isSafePaymentUrl("data:text/html,<script>1</script>")).toBe(false);
    expect(isSafePaymentUrl("/relative/path")).toBe(false);
    expect(isSafePaymentUrl("")).toBe(false);
  });
});
