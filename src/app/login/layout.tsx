import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — izam TM",
  description: "Sign in to the izam Traceability Matrix Management System",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
