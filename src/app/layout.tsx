import { Outlet } from "@tanstack/react-router";
import AppMenubar from "./components/app-menubar";

export default function AppLayout() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppMenubar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
