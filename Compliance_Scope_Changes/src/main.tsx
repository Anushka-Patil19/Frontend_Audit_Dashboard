import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import { SessionProvider } from "@/state/session";
import { ReviewProvider } from "@/state/review";
import { Shell } from "@/components/Shell";
import { Login } from "@/pages/Login";
import { Overview } from "@/pages/Overview";
import { ProjectDetail, ProjectsList } from "@/pages/Projects";
import { NcCasePage } from "@/pages/NcCase";
import { Review } from "@/pages/Review";
import { Observations } from "@/pages/Observations";
import { Reports } from "@/pages/Reports";
import { Notifications } from "@/pages/Notifications";
import { AuditTrail } from "@/pages/AuditTrail";
import { ScopePage } from "@/pages/Scope";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <ReviewProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Shell />}>
              <Route index element={<Overview />} />
              <Route path="projects" element={<ProjectsList />} />
              <Route path="projects/:pid" element={<ProjectDetail />} />
              <Route path="nc/:id" element={<NcCasePage />} />
              <Route path="review" element={<Review />} />
              <Route path="observations" element={<Observations />} />
              <Route path="scope" element={<ScopePage />} />
              <Route path="reports" element={<Reports />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="audit-trail" element={<AuditTrail />} />
              <Route path="*" element={<Overview />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ReviewProvider>
    </SessionProvider>
  </StrictMode>,
);
