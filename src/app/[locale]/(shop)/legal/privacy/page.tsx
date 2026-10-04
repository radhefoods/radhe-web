import type { Metadata } from "next";
import {
  LegalDocumentPage,
  legalMetadata,
} from "@/components/legal/legal-document-page";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/legal/privacy">;

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return legalMetadata("privacy", await localeOf(params));
}

export default async function Page({ params }: Props) {
  return <LegalDocumentPage type="privacy" locale={await localeOf(params)} />;
}
