import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { ApiError, errorMessage } from '../services/http';
import { authService } from '../services/authService';
import { countryService } from '../services/countryService';
import { subscriptionService } from '../services/subscriptionService';
import { subscriptionsEnabled } from '../config/features';
import { seedSubscriptionRequiredRoles } from '../data/seed';
import type { AccountRole, Country, Session, SubscriptionAccess } from '../types';

interface AppContextValue {
  countries: Country[];
  countriesLoading: boolean;
  countriesError: string;
  refreshCountries: () => Promise<void>;
  session: Session | null;
  countriesAreSeeded: boolean;
  subscriptionRequiredRoles: AccountRole[];
  accessRulesAreSeeded: boolean;
  subscriptionAccess: SubscriptionAccess | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSubscriptionAccess: () => Promise<void>;
  refreshAccessRules: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countriesError, setCountriesError] = useState('');
  const [countriesAreSeeded, setCountriesAreSeeded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [subscriptionRequiredRoles, setSubscriptionRequiredRoles] = useState<AccountRole[]>(subscriptionsEnabled ? seedSubscriptionRequiredRoles : []);
  const [accessRulesAreSeeded, setAccessRulesAreSeeded] = useState(subscriptionsEnabled);
  const [subscriptionAccess, setSubscriptionAccess] = useState<SubscriptionAccess | null>(null);

  const refreshSession = async () => {
    try {
      setSession(await authService.getSession());
    } catch (error) {
      if (error instanceof ApiError && error.code === 'unauthorized') setSession(null);
      else setSession(null);
    }
  };

  const signOut = async () => {
    try { await authService.signOut(); }
    finally { setSession(null); }
  };

  const refreshCountries = async () => {
    setCountriesLoading(true);
    setCountriesError('');
    try {
      setCountries(await countryService.list());
    } catch (error) {
      setCountries([]);
      setCountriesError(errorMessage(error));
    } finally {
      setCountriesLoading(false);
    }
  };

  const refreshSubscriptionAccess = async () => {
    if (!subscriptionsEnabled) { setSubscriptionAccess(null); return; }
    if (!session) { setSubscriptionAccess(null); return; }
    try { setSubscriptionAccess(await subscriptionService.access()); }
    catch { setSubscriptionAccess(null); }
  };

  const refreshAccessRules = async () => {
    if (!subscriptionsEnabled) { setSubscriptionRequiredRoles([]); setAccessRulesAreSeeded(false); return; }
    try {
      const result = await subscriptionService.accessRules();
      setSubscriptionRequiredRoles(result.requiredRoles);
      setAccessRulesAreSeeded(false);
    } catch {
      setSubscriptionRequiredRoles(seedSubscriptionRequiredRoles);
      setAccessRulesAreSeeded(true);
    }
  };

  useEffect(() => {
    void refreshSession();
    void refreshCountries();
    if (subscriptionsEnabled) {
      void subscriptionService.accessRules().then((result) => {
        setSubscriptionRequiredRoles(result.requiredRoles);
        setAccessRulesAreSeeded(false);
      }).catch(() => {
        setSubscriptionRequiredRoles(seedSubscriptionRequiredRoles);
        setAccessRulesAreSeeded(true);
      });
    }
  }, []);

  useEffect(() => { void refreshSubscriptionAccess(); }, [session]);

  return <AppContext.Provider value={{ countries, countriesLoading, countriesError, refreshCountries, session, countriesAreSeeded, subscriptionRequiredRoles, accessRulesAreSeeded, subscriptionAccess, refreshSession, signOut, refreshSubscriptionAccess, refreshAccessRules }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppContext must be used inside AppProvider.');
  return value;
}
