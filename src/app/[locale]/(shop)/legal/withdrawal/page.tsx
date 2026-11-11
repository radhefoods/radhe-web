import type { Metadata } from "next";
import {
  LegalDocumentPage,
  legalMetadata,
} from "@/components/legal/legal-document-page";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/legal/withdrawal">;

// The text the admin published in the panel; until there is one, the
// file of the shop (`content/legal`).
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return legalMetadata("withdrawal", await localeOf(params));
}

export default async function Page({ params }: Props) {
  return (
    <LegalDocumentPage type="withdrawal" locale={await localeOf(params)} />
  );
}
