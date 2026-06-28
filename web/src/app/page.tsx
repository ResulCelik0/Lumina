import { Dashboard } from "@/components/Dashboard";
import { ToastProvider } from "@/components/Toast";

export default function Home() {
  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  );
}
