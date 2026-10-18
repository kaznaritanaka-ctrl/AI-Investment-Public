"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

// The pinned Vinext Link shim's SPA navigation fails in the current Public
// build. Keep the original full-document Home navigation, without disabling
// the lint rule or upgrading the renderer. Modified clicks stay native.
export function HomeDocumentLink({ children, className, "aria-label": ariaLabel }: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.location.assign(event.currentTarget.href);
  }
  return <Link href="/" prefetch={false} onClick={navigate}
    className={className} aria-label={ariaLabel}>{children}</Link>;
}
