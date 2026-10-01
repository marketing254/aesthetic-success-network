import { Suspense } from "react";
import ThanksClient from "./ThanksClient";

export const metadata = {
  title: "You're on the list · Aesthetic Success Network",
  description:
    "Your application is in. Check your email for the next step from Aesthetic Success Network.",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ThanksClient />
    </Suspense>
  );
}
