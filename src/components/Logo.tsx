type LogoProps = {
  size?: number;
};

export default function Logo({ size = 36 }: LogoProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox="0 0 40 40"
      width={size}
    >
      <rect width="40" height="40" rx="12" fill="#6A58F5" />
      <path
        d="M10 9h20a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H21l-6 5v-5h-5a5 5 0 0 1-5-5V14a5 5 0 0 1 5-5z"
        fill="#fff"
      />
      <path
        d="m20 12.5 2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z"
        fill="#FF6B8B"
      />
    </svg>
  );
}
