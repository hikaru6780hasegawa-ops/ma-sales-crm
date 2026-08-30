import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Activities from "./pages/Activities";
import Deals from "./pages/Deals";
import MapPage from "./pages/MapPage";
import Reports from "./pages/Reports";
import Folders from "./pages/Folders";
import Scanner from "./pages/Scanner";
import CsvManager from "./pages/CsvManager";
import Settings from "./pages/Settings";
import ApiSettings from "./pages/ApiSettings";
import SlackMessages from "./pages/SlackMessages";
import CustomerFiles from "./pages/CustomerFiles";
import CustomerFileDetail from "./pages/CustomerFileDetail";
import DocumentChecklist from "./pages/DocumentChecklist";
import MeetingSheet from "./pages/MeetingSheet";
import MinutesChannel from "./pages/MinutesChannel";
import ConsultationSheet from "./pages/ConsultationSheet";
import FundingPlan from "./pages/FundingPlan";
import FundingPlanForm from "./pages/FundingPlanForm";
import PurchaseOffer from "./pages/PurchaseOffer";
import PurchaseOfferForm from "./pages/PurchaseOfferForm";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/document-checklist" component={DocumentChecklist} />
        <Route path="/meeting-sheet" component={MeetingSheet} />
        <Route path="/consultation-sheet" component={ConsultationSheet} />
        <Route path="/funding-plan" component={FundingPlan} />
        <Route path="/funding-plan/new" component={FundingPlanForm} />
        <Route path="/funding-plan/:id/edit" component={FundingPlanForm} />
        <Route path="/purchase-offer" component={PurchaseOffer} />
        <Route path="/purchase-offer/new" component={PurchaseOfferForm} />
        <Route path="/purchase-offer/:id/edit" component={PurchaseOfferForm} />
        <Route path="/customers" component={Customers} />
        <Route path="/customers/:id" component={CustomerDetail} />
        <Route path="/activities" component={Activities} />
        <Route path="/deals" component={Deals} />
        <Route path="/folders" component={Folders} />
        <Route path="/scanner" component={Scanner} />
        <Route path="/map" component={MapPage} />
        <Route path="/reports" component={Reports} />
        <Route path="/csv" component={CsvManager} />

        <Route path="/api-settings" component={ApiSettings} />
        <Route path="/slack" component={SlackMessages} />
        <Route path="/minutes" component={MinutesChannel} />
        <Route path="/customer-files" component={CustomerFiles} />
        <Route path="/customer-files/:id" component={CustomerFileDetail} />
        <Route path="/settings" component={Settings} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
