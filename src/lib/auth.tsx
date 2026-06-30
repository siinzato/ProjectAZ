import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Company {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'professional' | 'enterprise';
  settings: Record<string, unknown>;
}

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  company_id: string | null;
  role: 'owner' | 'admin' | 'manager' | 'counter' | 'viewer';
  must_change_password: boolean;
}

export type AuthView = 'landing' | 'login' | 'signup' | 'forgot' | 'confirm-email' | 'app';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  companyId: string;
  loading: boolean;
  view: AuthView;
  setView: (v: AuthView) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState<AuthView>('landing');

  const fetchProfile = useCallback(async (uid: string): Promise<Profile | null> => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, company_id, role, must_change_password')
      .eq('id', uid)
      .maybeSingle();
    return data as Profile | null;
  }, []);

  const fetchCompany = useCallback(async (companyId: string): Promise<Company | null> => {
    const { data } = await supabase
      .from('companies')
      .select('id, name, slug, plan, settings')
      .eq('id', companyId)
      .maybeSingle();
    return data as Company | null;
  }, []);

  const loadUser = useCallback(async (u: User) => {
    let prof = await fetchProfile(u.id);
    // Profile may not exist yet if trigger is slow — retry once
    if (!prof) {
      await new Promise(r => setTimeout(r, 1000));
      prof = await fetchProfile(u.id);
    }
    setProfile(prof);
    if (prof?.company_id) {
      const comp = await fetchCompany(prof.company_id);
      setCompany(comp);
    }
    return prof;
  }, [fetchProfile, fetchCompany]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const prof = await fetchProfile(user.id);
    setProfile(prof);
    if (prof?.company_id) {
      const comp = await fetchCompany(prof.company_id);
      setCompany(comp);
    }
  }, [user, fetchProfile, fetchCompany]);

  // Single source of truth: onAuthStateChange
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return;

      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setProfile(null);
        setCompany(null);
        setLoading(false);
        return;
      }

      // User signed in — load profile then decide view
      const prof = await loadUser(s.user);
      if (!mounted) return;

      if (!s.user.email_confirmed_at) {
        setView('confirm-email');
      } else if (!prof || !prof.company_id) {
        setView('signup');
      } else {
        setView('app');
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUser]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setCompany(null);
    setUser(null);
    setSession(null);
    setView('landing');
    setLoading(false);
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    company,
    companyId: profile?.company_id ?? '',
    loading,
    view,
    setView,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function canManageUsers(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canWrite(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager' || role === 'counter';
}
