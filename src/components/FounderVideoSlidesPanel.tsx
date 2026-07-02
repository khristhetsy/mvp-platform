import type { VideoSlide } from "@/lib/learning/video/video-types";
import { useTranslations } from "next-intl";

export function FounderVideoSlidesPanel({ slides }: Readonly<{ slides: VideoSlide[] }>) {
  const t = useTranslations("sharedCmp");
  if (slides.length === 0) {
    return <p className="text-sm text-slate-500">{t("slide_outline_will_appear_after_script_gener")}</p>;
  }

  return (
    <ol className="space-y-3">
      {slides.map((slide, index) => (
        <li key={slide.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">
            Scene {index + 1} · {slide.durationSeconds}s
          </p>
          <p className="mt-1 font-semibold text-slate-900">{slide.title}</p>
          <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
            {slide.bulletPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs italic text-slate-500">Narration: {slide.narrationCue}</p>
        </li>
      ))}
    </ol>
  );
}
