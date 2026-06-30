/**
 * Auth context — bulletproof implementation.
 *
 * Architecture rules:
 * 1. Never call supabase.from() inside onAuthStateChange — causes deadlock.
 *    DB queries run in a separate useEffect that watches `user`.
 * 2. `view` starts as 'landing' so the homepage is always immediate.
 * 3. Loading state has a 5s hard timeout to prevent infinite loading.
 * 4. Authenticated users NEVER get routed to 'signup'.
 */

import React, {
  createContext, useContext, useEffect, useState,
  useCallback, useRef,
} from 'react';
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
  | 'landing'
  | 'login'
  | 'signup'
  | 'forgot'
  | 'confirm-email'
  | 'link-company'
  | 'complete-profile'
  | 'auth-error'
  | 'app';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  companyId: string;
  authLoading: boolean;    // true while initial auth check runs
  profileLoading: boolean; // true while profile/company loads
  authError: string | null;
  view: AuthView;
  setView: (v: AuthView) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  retryAuth: () => void;
  linkToAZ: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AZ_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const LOAD_TIMEOUT_MS = 8000;

// ── Provider ──────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]               = useState<User | null>(null);
  const [session, setSession]         = useState<Session | null>(null);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [company, setCompany]         = useState<Company | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError]     = useState<string | null>(null);
  // Start on landing so homepage is never blocked
  const [view, setView]               = useState<AuthView>('landing');

  const mountedRef   = useRef(true);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load profile + company ────────────────────────────────────────────────
  const loadProfileAndCompany = useCallback(async (u: User): Promise<Profile | null> => {
    if (!mountedRef.current) return null;

    console.log('[Auth] Loading profile for', u.email, u.id);
    setProfileLoading(true);

    // Hard timeout to prevent infinite loading
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), LOAD_TIMEOUT_MS)
    );

    const fetchProfile = async () => {
      // Attempt 1
      const { data: p1, error: e1 } = await supabase
        .from('profiles')
        .select('id, name, email, company_id, role, must_change_password')
        .eq('id', u.id)
        .maybeSingle();

      if (e1) console.warn('[Auth] Profile fetch error:', e1.message);
      if (p1) return p1 as Profile;

      // Attempt 2 — trigger may be slow
      console.log('[Auth] Profile not found, retrying in 1s...');
      await new Promise(r => setTimeout(r, 1000));
      const { data: p2, error: e2 } = await supabase
        .from('profiles')
        .select('id, name, email, company_id, role, must_change_password')
        .eq('id', u.id)
        .maybeSingle();
      if (e2) console.warn('[Auth] Profile retry error:', e2.message);
      return (p2 as Profile | null) ?? null;
    };

    const prof = await Promise.race([fetchProfile(), timeoutPromise]);

    if (!mountedRef.current) return null;

    console.log('[Auth] Profile result:', prof);

    if (prof === null) {
      console.warn('[Auth] Profile load timed out or not found');
      setProfileLoading(false);
      return null;
    }

    setProfile(prof);

    // Load company
    if (prof.company_id) {
      const { data: comp, error: compErr } = await supabase
        .from('companies')
        .select('id, name, slug, plan, settings')
        .eq('id', prof.company_id)
        .maybeSingle();

      if (compErr) console.warn('[Auth] Company fetch error:', compErr.message);
      console.log('[Auth] Company result:', comp);
      if (mountedRef.current) setCompany(comp as Company | null);
    }

    if (mountedRef.current) setProfileLoading(false);
    return prof;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadProfileAndCompany(user);
  }, [user, loadProfileAndCompany]);

  // ── Resolve view after profile loads ──────────────────────────────────────
  const resolveAppView = useCallback((u: User, prof: Profile | null) => {
    if (!u.email_confirmed_at) {
      console.log('[Auth] Redirect → confirm-email');
      setView('confirm-email');
      return;
    }
    if (!prof) {
      console.log('[Auth] Redirect → complete-profile (no profile)');
      setView('complete-profile');
      return;
    }
    if (!prof.company_id) {
      console.log('[Auth] Redirect → link-company (no company_id)');
      setView('link-company');
      return;
    }
    console.log('[Auth] Redirect → app. Role:', prof.role, 'Company:', prof.company_id);
    setView('app');
  }, []);

  // ── onAuthStateChange — only sets user/session, NEVER calls DB ────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mountedRef.current) return;
      console.log('[Auth] onAuthStateChange:', event, s?.user?.email ?? 'no user');

      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setProfile(null);
        setCompany(null);
        setAuthLoading(false);
        setProfileLoading(false);
      }
      // When user exists, the separate useEffect below handles profile loading
    });

    // Global timeout: if authLoading is still true after LOAD_TIMEOUT_MS, show error
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setAuthLoading(prev => {
        if (prev) {
          console.warn('[Auth] Auth load timed out');
          setAuthError('O carregamento demorou demais. Verifique sua conexão.');
          setView('auth-error');
        }
        return false;
      });
    }, LOAD_TIMEOUT_MS);

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // ── Watch user — load profile when user changes ───────────────────────────
  useEffect(() => {
    if (authLoading === true && user === null) {
      // onAuthStateChange hasn't fired yet — wait
      return;
    }

    if (!user) {
      // Not logged in — clear state, go to landing (unless on an auth sub-page)
      setAuthLoading(false);
      setProfileLoading(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      setView(current => {
        const authSubPages: AuthView[] = ['login', 'signup', 'forgot', 'confirm-email'];
        if (authSubPages.includes(current)) return current; // stay on auth page
        return 'landing'; // everything else → landing
      });

      console.log('[Auth] No user → view: landing/auth-page');
      return;
    }

    // User is logged in — load profile
    loadProfileAndCompany(user).then(prof => {
      if (!mountedRef.current) return;
      setAuthLoading(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      resolveAppView(user, prof);
    });
  }, [user, authLoading, loadProfileAndCompany, resolveAppView]);

  // ── signOut ────────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    if (!mountedRef.current) return;
    setProfile(null);
    setCompany(null);
    setAuthError(null);
    setView('landing');
  }, []);

  // ── retryAuth ─────────────────────────────────────────────────────────────
  const retryAuth = useCallback(() => {
    setAuthError(null);
    setAuthLoading(true);
    setView('landing');
    window.location.reload();
  }, []);

  // ── linkToAZ — fix a user that has no company_id ──────────────────────────
  const linkToAZ = useCallback(async () => {
    if (!user) return;
    const role = user.email === 'victor@azbuy.com.br' ? 'owner' : 'viewer';
    const { error } = await supabase
      .from('profiles')
      .update({ company_id: AZ_COMPANY_ID, role })
      .eq('id', user.id);

    if (error) {
      console.error('[Auth] linkToAZ error:', error.message);
      return;
    }
    await refreshProfile().then(() => {
      if (mountedRef.current) {
        setView('app');
      }
    });
  }, [user, refreshProfile]);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    company,
    companyId: profile?.company_id ?? '',
    authLoading,
    profileLoading,
    authError,
    view,
    setView,
    signOut,
    refreshProfile,
    retryAuth,
    linkToAZ,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// ── Role helpers ──────────────────────────────────────────────────────────────

export function canManageUsers(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canWrite(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager' || role === 'counter';
}
