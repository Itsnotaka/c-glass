import type { SVGProps } from "react";

// Cursor Editor Icon
export function IconCursorEditor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="24" height="24" rx="4" fill="#1E1E1E" />
      <path d="M12 6L6 18H9L10.5 14.5H13.5L12 18H15L18 6H12Z" fill="white" />
      <path d="M12 6L9 12H15L12 6Z" fill="#38BDF8" />
    </svg>
  );
}

// VS Code Editor Icon
export function IconVSCodeEditor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="24" height="24" rx="4" fill="#2C2C32" />
      <path d="M17 6L8 11L5 8.5V15.5L8 13L17 18V6Z" fill="#007ACC" />
      <path d="M17 6L14.5 7.5V16.5L17 18V6Z" fill="#1F9CF0" />
    </svg>
  );
}

// VS Code Insiders Icon
export function IconVSCodeInsidersEditor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="24" height="24" rx="4" fill="#2C2C32" />
      <path d="M17 6L8 11L5 8.5V15.5L8 13L17 18V6Z" fill="#24BFA5" />
      <path d="M17 6L14.5 7.5V16.5L17 18V6Z" fill="#40C4AA" />
    </svg>
  );
}

// VSCodium Icon
export function IconVSCodiumEditor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="24" height="24" rx="4" fill="#2C2C32" />
      <path d="M17 6L8 11L5 8.5V15.5L8 13L17 18V6Z" fill="#7AC7A6" />
      <path d="M17 6L14.5 7.5V16.5L17 18V6Z" fill="#A9D6BC" />
    </svg>
  );
}

// Zed Editor Icon
export function IconZedEditor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="24" height="24" rx="4" fill="#0E0E0E" />
      <path d="M6 6H18L12 12L18 18H6L12 12L6 6Z" fill="#D4A574" />
    </svg>
  );
}

// Antigravity Editor Icon
export function IconAntigravityEditor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="24" height="24" rx="4" fill="#1A1A1A" />
      <circle cx="12" cy="12" r="6" stroke="#FF6B6B" strokeWidth="2" fill="none" />
      <path d="M12 6V12L16 16" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Generic Code Editor Icon (fallback)
export function IconGenericEditor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="24" height="24" rx="4" fill="#3B3B3B" />
      <path
        d="M8 8L5 12L8 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 8L19 12L16 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 18L13 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
