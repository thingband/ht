import { createFileRoute, redirect } from "@tanstack/react-router";

/** The halftone app is a self-contained static page in `public/`; send `/` to it. */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/app.html" });
  },
});
