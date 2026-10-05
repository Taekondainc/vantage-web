import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider";

const AppShell = lazy(() => import("./pages/AppShell").then((m) => ({ default: m.AppShell })));
const SignInPage = lazy(() => import("./pages/SignInPage").then((m) => ({ default: m.SignInPage })));
const AuthCompletePage = lazy(() => import("./pages/AuthCompletePage").then((m) => ({ default: m.AuthCompletePage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const TasksPage = lazy(() => import("./pages/TasksPage").then((m) => ({ default: m.TasksPage })));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage").then((m) => ({ default: m.ProjectDetailPage })));
const BillingPage = lazy(() => import("./pages/BillingPage").then((m) => ({ default: m.BillingPage })));
const HomePage = lazy(() => import("./pages/marketing/HomePage").then((m) => ({ default: m.HomePage })));
const FeaturesPage = lazy(() => import("./pages/marketing/FeaturesPage").then((m) => ({ default: m.FeaturesPage })));
const TemplatesPage = lazy(() => import("./pages/marketing/TemplatesPage").then((m) => ({ default: m.TemplatesPage })));
const ComparePage = lazy(() => import("./pages/marketing/ComparePage").then((m) => ({ default: m.ComparePage })));
const PricingPage = lazy(() => import("./pages/marketing/PricingPage").then((m) => ({ default: m.PricingPage })));
const FaqPage = lazy(() => import("./pages/marketing/FaqPage").then((m) => ({ default: m.FaqPage })));
const AboutPage = lazy(() => import("./pages/marketing/AboutPage").then((m) => ({ default: m.AboutPage })));
const DownloadPage = lazy(() => import("./pages/marketing/DownloadPage").then((m) => ({ default: m.DownloadPage })));
const PrivacyPage = lazy(() => import("./pages/marketing/LegalPages").then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("./pages/marketing/LegalPages").then((m) => ({ default: m.TermsPage })));
const NotFoundPage = lazy(() => import("./pages/marketing/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="grid min-h-screen place-items-center bg-canvas font-mono text-sm text-muted">Loading...</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/legal/privacy" element={<PrivacyPage />} />
            <Route path="/legal/terms" element={<TermsPage />} />
            <Route path="/app/sign-in" element={<SignInPage />} />
            <Route path="/app/signin" element={<SignInPage />} />
            <Route path="/app/auth/complete" element={<AuthCompletePage />} />
            <Route path="/app" element={<AppShell />}>
              <Route index element={<ReportsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="objectives" element={<Navigate to="/app/tasks" replace />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
