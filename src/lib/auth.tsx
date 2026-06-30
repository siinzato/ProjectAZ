// Auth context
// IMPORTANT: Never call supabase.from() directly inside onAuthStateChange callback —
// it deadlocks because the auth token hasn't been committed to the client yet.
// Instead, watch the `user` state in a separate useEffect.

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

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

export type AuthView =
  | 'loading'
  | 'landing'
  | 'login'
  | 'signup'
  | 'forgot'
  | 'confirm-email'
  | 'complete-profile'
  | 'link-company'
  | 'app';

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

const AZ_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

// ── Provider ──────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState<AuthView>('loading');

  // Track if we're already loading the profile to avoid duplicate calls
  const profileLoadingRef = useRef(false);

  // ── Load profile + company (safe to call from useEffect, NOT from onAuthStateChange) ──
  const loadProfileAndCompany = useCallback(async (u: User): Promise<void> => {
    if (profileLoadingRef.current) return;
    profileLoadingRef.current = true;

    try {
      console.log('[Auth] Loading profile for', u.email, u.id);

      let prof: Profile | null = null;

      // Attempt 1
      const res1 = await supabase
        .from('profiles')
        .select('id, name, email, company_id, role, must_change_password')
        .eq('id', u.id)
        .maybeSingle();

      if (res1.error) console.warn('[Auth] Profile fetch error:', res1.error.message);
      prof = res1.data as Profile | null;

      // Attempt 2 — profile may not exist yet if trigger is slow
      if (!prof) {
        console.log('[Auth] Profile not found, retrying in 1s...');
        await new Promise(r => setTimeout(r, 1000));
        const res2 = await supabase
          .from('profiles')
          .select('id, name, email, company_id, role, must_change_password')
          .eq('id', u.id)
          .maybeSingle();
        prof = res2.data as Profile | null;
      }

      console.log('[Auth] Profile loaded:', prof);
      setProfile(prof);

      // Load company
      if (prof?.company_id) {
        const { data: comp, error: compErr } = await supabase
          .from('companies')
          .select('id, name, slug, plan, settings')
          .eq('id', prof.company_id)
          .maybeSingle();

        if (compErr) console.warn('[Auth] Company fetch error:', compErr.message);
        console.log('[Auth] Company loaded:', comp);
        setCompany(comp as Company | null);
      }
    } finally {
      profileLoadingRef.current = false;
    }
  }, []);

  // ── Derive view whenever auth state changes ────────────────────────────────
  useEffect(() => {
    if (loading) return;

    console.log('[Auth] Deriving view — user:', user?.email, 'profile:', profile?.role, 'company_id:', profile?.company_id);

    if (!user) {
      setView(v => (['app', 'complete-profile', 'link-company'].includes(v) ? 'landing' : v));
      return;
    }

    if (!user.email_confirmed_at) {
      setView('confirm-email');
      return;
    }

    // User is authenticated — NEVER redirect to signup
    if (!profile) {
      // Profile still loading — wait (view stays as-is, loading spinner shown)
      console.log('[Auth] Profile not yet loaded, waiting...');
      return;
    }

    if (!profile.company_id) {
      // Authenticated but no company — try to auto-link to AZ first
      console.log('[Auth] No company_id, showing link-company screen');
      setView('link-company');
      return;
    }

    console.log('[Auth] All good → app. Role:', profile.role);
    setView('app');
  }, [loading, user, profile]);

  // ── Auth state: only set user/session here, NOT db queries ────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      console.log('[Auth] onAuthStateChange event:', event, 'user:', s?.user?.email);
      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setProfile(null);
        setCompany(null);
        profileLoadingRef.current = false;
        setLoading(false);
      }
      // Profile loading is handled by the separate useEffect below
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Watch user — load profile when user changes ────────────────────────────
  useEffect(() => {
    if (user === undefined) return; // still initializing

    if (!user) {
      setLoading(false);
      return;
    }

    // user changed — load their profile
    profileLoadingRef.current = false; // reset so we can load again
    loadProfileAndCompany(user).finally(() => setLoading(false));
  }, [user, loadProfileAndCompany]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    profileLoadingRef.current = false;
    await loadProfileAndCompany(user);
  }, [user, loadProfileAndCompany]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setCompany(null);
    setView('landing');
    setLoading(false);
  }, []);

  // ── Auto-link to AZ if authenticated user has no company ──────────────────
  const linkToAZ = useCallback(async () => {
    if (!user || !profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({ company_id: AZ_COMPANY_ID, role: 'owner' })
      .eq('id', user.id);
    if (!error) {
      await refreshProfile();
    }
  }, [user, profile, refreshProfile]);

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
    // @ts-ignore — exposed for link-company screen
    linkToAZ,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx as AuthContextValue & { linkToAZ?: () => Promise<void> };
}

export function canManageUsers(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canWrite(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager' || role === 'counter';
}
