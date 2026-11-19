import { Coffee, ExternalLink } from "lucide-react";
import type { SupportedLocale } from "../../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";

export interface KofiSupportBannerProps {
  locale?: SupportedLocale;
  context: "landing" | "end_run" | "milestone";
  testId?: string;
  className?: string;
}

export function KofiSupportBanner({
  locale,
  context,
  testId = "kofi-support-banner",
  className = "",
}: KofiSupportBannerProps) {
  const { kofi } = getUiStrings(locale);
  const prompt =
    context === "landing"
      ? kofi.landingPrompt
      : context === "end_run"
        ? kofi.endRunPrompt
        : kofi.milestonePrompt;

  return (
    <div
      data-testid={testId}
      className={`kofi-support-banner rounded-xl border-2 border-[#1f2421] bg-[#fcf4df] px-2.5 sm:px-3.5 py-1.5 sm:py-2 shadow-[2px_2px_0px_0px_rgba(31,36,33,0.85)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2.5 ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="stamp-badge text-[9.5px] sm:text-[10px] px-1.5 py-0.5 rounded bg-[#7a4308] text-[#fffdf8] shrink-0">
          {kofi.badge}
        </span>
        <p className="text-xs text-[#1f2421] font-medium leading-snug min-w-0">{prompt}</p>
      </div>

      <a
        href={kofi.url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`${testId}-link`}
        aria-label={kofi.ariaLabel}
        className="min-h-11 sm:min-h-9 px-3 py-1.5 sm:py-1 rounded-lg border-2 border-[#1f2421] bg-[#1f2421] hover:bg-[#313834] text-[#fce592] font-bold text-xs sm:text-[12.5px] leading-tight inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors no-underline"
      >
        <Coffee className="w-3.5 h-3.5 text-[#fce592] shrink-0" aria-hidden="true" />
        <span>{kofi.ctaLabel}</span>
        <ExternalLink className="w-3 h-3 text-[#efe4ce] shrink-0" aria-hidden="true" />
      </a>
    </div>
  );
}
