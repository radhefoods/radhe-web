import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <div className="container-page flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-ink-muted text-sm font-bold tracking-wider uppercase">
        404
      </p>
      <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
        {t("title")}
      </h1>
      <p className="text-ink-muted max-w-md">{t("text")}</p>
      <Link href="/" className={buttonStyles()}>
        {t("home")}
      </Link>
    </div>
  );
}
