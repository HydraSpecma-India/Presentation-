import Link from "next/link";
import { AccessMessage, buttonClasses } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="py-16 px-4">
      <AccessMessage eyebrow="404" title="Page not found">
        <p className="mb-5">The page doesn&apos;t exist or has been moved.</p>
        <Link href="/" className={buttonClasses("primary")}>
          Go to reports
        </Link>
      </AccessMessage>
    </div>
  );
}
