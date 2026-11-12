import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { RequireAuth, RequireRole } from "@/auth/guards";
import { ToastProvider } from "@/components/Toast";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { SignUpPage } from "@/pages/SignUpPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { AuthActionPage } from "@/pages/AuthActionPage";
import { BoardsPage } from "@/pages/BoardsPage";
import { BoardPage } from "@/pages/BoardPage";
import { MyTasksPage } from "@/pages/MyTasksPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || undefined}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/action" element={<AuthActionPage />} />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<BoardsPage />} />
              <Route path="boards/:boardId/*" element={<BoardPage />} />
              <Route path="my-tasks" element={<MyTasksPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route
                path="admin/users"
                element={
                  <RequireRole roles={["admin"]}>
                    <AdminUsersPage />
                  </RequireRole>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
