"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { ISSUE_PHOTOS_MAX, ISSUE_PHOTO_TYPES } from "@/features/issues/issues";
import { cn } from "@/lib/cn";

/**
 * The photos of a problem report (doc 23): up to five JPEG, PNG or WebP
 * pictures, each shown as it is chosen with a button to take it off, and
 * a dashed tile that opens the picker. `already` counts the photos the
 * report has on the server, when more are added later.
 */
export function PhotoPicker({
  id,
  files,
  onChange,
  already = 0,
}: {
  id: string;
  files: File[];
  onChange: (files: File[]) => void;
  already?: number;
}) {
  const t = useTranslations("issues");
  const [problem, setProblem] = useState<string | null>(null);
  const room = ISSUE_PHOTOS_MAX - already - files.length;
  // One address per picture, released when it goes.
  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );
  useEffect(
    () => () => {
      for (const url of previews) URL.revokeObjectURL(url);
    },
    [previews],
  );

  function add(chosen: FileList | null) {
    if (!chosen) return;
    const picked = [...chosen];
    const wrong = picked.some((file) => !ISSUE_PHOTO_TYPES.includes(file.type));
    const accepted = picked.filter((file) =>
      ISSUE_PHOTO_TYPES.includes(file.type),
    );
    const tooMany = accepted.length > room;
    setProblem(
      wrong ? t("photoWrongType") : tooMany ? t("photoTooMany") : null,
    );
    if (accepted.length > 0) {
      onChange([...files, ...accepted.slice(0, Math.max(0, room))]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-3">
        {files.map((file, index) => (
          <li key={`${file.name}-${index}`} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previews[index]}
              alt={file.name}
              className="ring-ink/8 size-24 rounded-xl object-cover ring-1"
            />
            <button
              type="button"
              aria-label={t("photoRemove", { index: index + 1 })}
              onClick={() =>
                onChange(files.filter((_, other) => other !== index))
              }
              className="bg-ink/70 hover:bg-ink absolute -top-2 -right-2 grid size-7 place-items-center rounded-full text-white transition-transform duration-150 active:scale-90"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
        {room > 0 && (
          <li>
            <label
              className={cn(
                "border-ink/15 hover:border-leaf-600 hover:bg-leaf-50/60 has-focus-visible:outline-leaf-600 relative flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition-colors duration-200 has-focus-visible:outline-2 has-focus-visible:outline-offset-1",
                files.length === 0 ? "w-full sm:w-auto" : "",
              )}
            >
              <input
                id={id}
                type="file"
                accept={ISSUE_PHOTO_TYPES.join(",")}
                multiple
                onChange={(event) => {
                  add(event.target.files);
                  event.target.value = "";
                }}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
              <span
                aria-hidden="true"
                className="bg-leaf-50 text-leaf-700 grid size-10 shrink-0 place-items-center rounded-full"
              >
                <Plus className="size-5" />
              </span>
              <span className="flex flex-col">
                <span className="font-semibold">{t("photos")}</span>
                <span className="text-ink-muted text-sm">
                  {t("photosHint")}
                </span>
              </span>
            </label>
          </li>
        )}
      </ul>
      {problem && (
        <p role="alert" className="text-sm font-semibold text-red-800">
          {problem}
        </p>
      )}
    </div>
  );
}
