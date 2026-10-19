import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Shell } from './components/Shell';
import { MarketplacePage } from './pages/MarketplacePage';
import { AdminPage } from './pages/AdminPage';
import { AuthPage } from './pages/AuthPage';
import { SellerOnboardingPage, SellerDashboardPage } from './pages/SellerPages';
import { ListingDetailPage, ShopPage } from './pages/DetailsPages';
import { AccountPage } from './pages/AccountPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { EnquiriesPage } from './pages/EnquiriesPage';
import { SupportPage, InformationPage } from './pages/InfoPages';
import { DripAiPage } from './pages/DripAiPage';
import { StyleSwipePage } from './pages/StyleSwipePage';

export function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<MarketplacePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/seller/setup" element={<SellerOnboardingPage />} />
          <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
          <Route path="/listings/:listingId" element={<ListingDetailPage />} />
          <Route path="/shops/:shopId" element={<ShopPage />} />
          <Route path="/drip-ai" element={<DripAiPage />} />
          <Route path="/style-swipe" element={<StyleSwipePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/enquiries" element={<EnquiriesPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/policies" element={<InformationPage />} />
          <Route path="/auth/sign-in" element={<AuthPage mode="signin" />} />
          <Route path="/auth/sign-up" element={<AuthPage mode="signup" />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}
export default App;
