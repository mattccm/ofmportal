import Image from "next/image";
import { BRAND } from "@/lib/brand";

/**
 * Sign-in, reset and register share this frame. On a desktop the left half is
 * a typeset cover in the Title Wall world: the product's name set as display
 * lettering on a tile that fades into the ground. On a phone the cover folds
 * into a short bar above the form.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const year = new Date().getFullYear();

  return (
    <div
      className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row"
      style={{
        minHeight: "100dvh",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Phone: the mark and the name in one bar */}
      <div className="flex shrink-0 items-center gap-3 px-6 pt-6 lg:hidden">
        <Image
          src={BRAND.logoPath}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 object-contain invert"
          priority
        />
        <p className="text-lg font-bold tracking-tight">{BRAND.productName}</p>
      </div>

      {/* Desktop: the cover */}
      <div className="relative isolate hidden overflow-hidden lg:flex lg:w-1/2">
        <div className="tw-billboard-plate" aria-hidden="true" />
        <div className="relative flex w-full flex-col justify-between p-12 xl:p-16">
          <Image
            src={BRAND.logoPath}
            alt={BRAND.name}
            width={48}
            height={48}
            className="h-12 w-12 object-contain invert"
            priority
          />

          <div className="max-w-xl">
            <p className="text-[clamp(64px,7vw,104px)] font-extrabold leading-[0.92] tracking-[-0.04em]">
              {BRAND.productName}
            </p>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-2">
              Requests, uploads and review for {BRAND.name} and its creators, in one place.
            </p>
          </div>

          <p className="text-sm text-ink-2">
            &copy; {year} {BRAND.legalName}
          </p>
        </div>
      </div>

      {/* The form */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto px-6 py-8 md:items-center lg:p-12">
        <div className="w-full max-w-md space-y-6">{children}</div>
      </div>

      <p className="shrink-0 px-6 py-4 text-center text-xs text-ink-2 lg:hidden">
        &copy; {year} {BRAND.legalName}
      </p>
    </div>
  );
}
