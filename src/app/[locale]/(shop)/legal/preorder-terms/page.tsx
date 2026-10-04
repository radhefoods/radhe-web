import type { Metadata } from "next";
import {
  LegalDocumentPage,
  legalMetadata,
} from "@/components/legal/legal-document-page";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/legal/preorder-terms">;

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return legalMetadata("preorder_terms", await localeOf(params));
}

export default async function Page({ params }: Props) {
  return (
    <LegalDocumentPage type="preorder_terms" locale={await localeOf(params)} />
  );
}
