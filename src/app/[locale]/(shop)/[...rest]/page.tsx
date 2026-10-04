import { notFound } from "next/navigation";

// Any address inside a language that no page answers: show the localized
// "not found" page instead of the bare default.
export default function CatchAll() {
  notFound();
}
