import type { Metadata } from "next";
import {
  StaticLegalPage,
  staticLegalMetadata,
} from "@/components/legal/static-legal-page";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/legal/withdrawal">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return staticLegalMetadata("withdrawal", await localeOf(params));
}

export default async function Page({ params }: Props) {
  return <StaticLegalPage name="withdrawal" locale={await localeOf(params)} />;
}
