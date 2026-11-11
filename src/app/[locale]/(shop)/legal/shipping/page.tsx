import type { Metadata } from "next";
import {
  LegalDocumentPage,
  legalMetadata,
} from "@/components/legal/legal-document-page";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/legal/shipping">;

// The text the admin published in the panel; without one the page
// answers 404 and nothing links it.
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return legalMetadata("shipping", await localeOf(params));
}

export default async function Page({ params }: Props) {
  return <LegalDocumentPage type="shipping" locale={await localeOf(params)} />;
}
