import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * Three-dot indicator shown while the agent composes a reply. The dots bounce,
 * but fall back to static dots when the user prefers reduced motion (SVG SMIL
 * animations don't honor the CSS reduced-motion guard on their own).
 */
export function MessageLoading() {
  const reduced = usePrefersReducedMotion();
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="text-muted-foreground"
      aria-hidden="true"
    >
      <circle cx="4" cy="12" r="2" fill="currentColor">
        {!reduced && (
          <animate
            id="spinner_qFRN"
            begin="0;spinner_OcgL.end+0.25s"
            attributeName="cy"
            calcMode="spline"
            dur="0.6s"
            values="12;6;12"
            keySplines=".33,.66,.66,1;.33,0,.66,.33"
          />
        )}
      </circle>
      <circle cx="12" cy="12" r="2" fill="currentColor">
        {!reduced && (
          <animate
            begin="spinner_qFRN.begin+0.1s"
            attributeName="cy"
            calcMode="spline"
            dur="0.6s"
            values="12;6;12"
            keySplines=".33,.66,.66,1;.33,0,.66,.33"
          />
        )}
      </circle>
      <circle cx="20" cy="12" r="2" fill="currentColor">
        {!reduced && (
          <animate
            id="spinner_OcgL"
            begin="spinner_qFRN.begin+0.2s"
            attributeName="cy"
            calcMode="spline"
            dur="0.6s"
            values="12;6;12"
            keySplines=".33,.66,.66,1;.33,0,.66,.33"
          />
        )}
      </circle>
    </svg>
  );
}
