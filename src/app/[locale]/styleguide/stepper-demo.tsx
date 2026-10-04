"use client";

import { useState } from "react";
import { QuantityStepper } from "@/components/ui/quantity-stepper";

export function StepperDemo() {
  const [quantity, setQuantity] = useState(2);
  return (
    <QuantityStepper
      value={quantity}
      min={1}
      max={10}
      // "Remove" would take the stepper away; the demo starts again at 1.
      onChange={(next) => setQuantity(Math.max(1, next))}
      className="max-w-48"
      labels={{
        quantity: "Quantity",
        increase: "One more",
        decrease: "One less",
        remove: "Remove",
      }}
    />
  );
}
