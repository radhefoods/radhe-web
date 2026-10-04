import type { Metadata } from "next";
import {
  StaticLegalPage,
  staticLegalMetadata,
} from "@/components/legal/static-legal-page";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/legal/imprint">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return staticLegalMetadata("imprint", await localeOf(params));
}

export default async function Page({ params }: Props) {
  return <StaticLegalPage name="imprint" locale={await localeOf(params)} />;
}
