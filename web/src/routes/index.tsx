import { createFileRoute } from "@tanstack/react-router";
import { JoinForm } from "@/components/JoinForm";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <JoinForm />;
}
