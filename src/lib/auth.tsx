// Auth context — provides user, profile, company to the whole app.
// Pattern: onAuthStateChange sets user; a separate effect loads profile/company.
// Safety: async work inside onAuthStateChange uses an IIFE to avoid deadlock.

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

export type AuthView = 'landing' | 'login' | 'signup' | 'forgot' | 'confirm-email' | 'app';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  companyId: string;          // '' when not loaded yet
  loading: boolean;
  view: AuthView;
  setView: (v: AuthView) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState<AuthView>('landing');

  // ── Load profile + company for a given user ──────────────────────────────
  const loadProfileAndCompany = useCallback(async (u: User) => {
    // Fetch profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, name, email, company_id, role, must_change_password')
      .eq('id', u.id)
      .maybeSingle();

    if (!prof) {
      // Profile not yet created (race condition) — retry once after 800ms
      await new Promise(r => setTimeout(r, 800));
      const { data: prof2 } = await supabase
        .from('profiles')
        .select('id, name, email, company_id, role, must_change_password')
        .eq('id', u.id)
        .maybeSingle();
      setProfile(prof2 as Profile | null);
      if (prof2?.company_id) {
        const { data: comp } = await supabase
          .from('companies')
          .select('id, name, slug, plan, settings')
          .eq('id', prof2.company_id)
          .maybeSingle();
        setCompany(comp as Company | null);
      }
    } else {
      setProfile(prof as Profile);
      if (prof.company_id) {
        const { data: comp } = await supabase
          .from('companies')
          .select('id, name, slug, plan, settings')
          .eq('id', prof.company_id)
          .maybeSingle();
        setCompany(comp as Company | null);
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfileAndCompany(user);
  }, [user, loadProfileAndCompany]);

  // ── Initial session + subscribe ──────────────────────────────────────────
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfileAndCompany(s.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      // Wrap async work in IIFE to avoid onAuthStateChange deadlock
      (async () => {
        if (s?.user) {
          await loadProfileAndCompany(s.user);
        } else {
          setProfile(null);
          setCompany(null);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, [loadProfileAndCompany]);

  // ── Derive view from auth state ──────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setView(v => (v === 'app' ? 'landing' : v));
      return;
    }
    // User is authenticated
    if (!user.email_confirmed_at) {
      setView('confirm-email');
      return;
    }
    // Wait for profile to finish loading before routing to app
    if (!profile) return;
    if (!profile.company_id) {
      // Authenticated but no company — show signup flow to finish setup
      setView('signup');
      return;
    }
    setView('app');
  }, [loading, user, profile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setCompany(null);
    setView('landing');
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
