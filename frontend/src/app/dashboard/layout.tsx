
import type { ReactNode } from "react";
import { Container } from "react-bootstrap";

import SidebarProvider from "@/components/Layout/Dashboard/SidebarProvider";
import SidebarOverlay from "@/components/Layout/Dashboard/Sidebar/SidebarOverlay";
import Sidebar from "@/components/Layout/Dashboard/Sidebar/Sidebar";
import SidebarNav from "@/components/Layout/Dashboard/Sidebar/SidebarNav";
import Header from "@/components/Layout/Dashboard/Header/Header";
import Footer from "@/components/Layout/Dashboard/Footer/Footer";

import { requireIdentity } from "@/lib/auth/get-identity";
import { getDictionary } from "@/locales/dictionary";
import { AssetFlowDictionaryProvider } from "@/locales/assetflow-dictionary-provider";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({
  children
}: DashboardLayoutProps) {
  const user = await requireIdentity();
  const dictionary = await getDictionary();

  return (
    <AssetFlowDictionaryProvider dictionary={dictionary}>
      <SidebarProvider>
        <SidebarOverlay />

        <Sidebar>
          <SidebarNav roleCode={user.role_code} />
        </Sidebar>

        <div className="wrapper d-flex flex-column min-vh-100">
          <Header
            fullName={user.full_name}
            email={user.email}
            roleCode={user.role_code}
          />

          <main className="body flex-grow-1 px-sm-2 mb-4">
            <Container fluid="lg">
              {children}
            </Container>
          </main>

          <Footer />
        </div>
      </SidebarProvider>
    </AssetFlowDictionaryProvider>
  );
}
