import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Database } from './database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initializing: boolean;
  signInCustomer: (username: string, password: string) => Promise<void>;
  signInAdmin: (username: string, password: string) => Promise<void>;
  signInCashier: (username: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signUpCustomer: (username: string, password: string, fullName: string) => Promise<void>;
  signUpAdmin: (username: string, email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  const fetchProfile = useCallback(async (userId: string, retries = 5): Promise<Profile | null> => {
    try {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setProfile(data);
          return data;
        }

        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      setProfile(null);
      return null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      return null;
    }
  }, []);

  // Initialize auth and listen for state changes
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        setUser(session?.user ?? null);
        if (session?.user) {
          const prof = await fetchProfile(session.user.id);
          if (!cancelled) {
            if (!prof) {
              // No profile found - clear user
              setUser(null);
              setProfile(null);
            }
            setLoading(false);
            setInitializing(false);
          }
        } else {
          setLoading(false);
          setInitializing(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          setInitializing(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
        // Fetch profile for the new user
        const userId = session?.user?.id;
        if (userId) {
          (async () => {
            setLoading(true);
            const prof = await fetchProfile(userId);
            if (cancelled) return;
            if (!prof) {
              setUser(null);
              setProfile(null);
            }
            setLoading(false);
          })();
        }
        return;
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInCustomer = async (username: string, password: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('username', username)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profileData) throw new Error('Wrong username');
    if (profileData.role !== 'customer') throw new Error('Invalid credentials for customer login');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: profileData.email,
      password,
    });
    if (error) throw new Error('Wrong password');

    if (data.user) {
      setUser(data.user);
      const prof = await fetchProfile(data.user.id);
      if (prof) setProfile(prof);
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'customer' } },
    });
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
      const prof = await fetchProfile(data.user.id);
      if (prof) setProfile(prof);
      setLoading(false);
    }
  };

  const signUpCustomer = async (username: string, password: string, fullName: string) => {
    const email = `${username}@customer.local`;

    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (existingUser) throw new Error('Username already exists');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, full_name: fullName, role: 'customer' } },
    });
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
      const prof = await fetchProfile(data.user.id);
      if (prof) setProfile(prof);
      setLoading(false);
    }
  };

  const signInAdmin = async (username: string, password: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('username', username)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profileData) throw new Error('Wrong username');
    if (profileData.role !== 'admin') throw new Error('Invalid credentials for admin login');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: profileData.email,
      password,
    });
    if (error) throw new Error('Wrong password');

    if (data.user) {
      setUser(data.user);
      const prof = await fetchProfile(data.user.id);
      if (prof) setProfile(prof);
      setLoading(false);
    }
  };

  const signInCashier = async (username: string, password: string) => {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('username', username)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profileData) throw new Error('Wrong username');
    if (profileData.role !== 'cashier') throw new Error('Invalid credentials for cashier login');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: profileData.email,
      password,
    });
    if (error) throw new Error('Wrong password');

    if (data.user) {
      setUser(data.user);
      const prof = await fetchProfile(data.user.id);
      if (prof) setProfile(prof);
      setLoading(false);
    }
  };

  const signUpAdmin = async (username: string, email: string, password: string, fullName: string) => {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (existingUser) throw new Error('Username already exists');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, full_name: fullName, role: 'admin' } },
    });
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
      const prof = await fetchProfile(data.user.id);
      if (prof) setProfile(prof);
      setLoading(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    profile,
    loading,
    initializing,
    signInCustomer,
    signInAdmin,
    signInCashier,
    signUp,
    signUpCustomer,
    signUpAdmin,
    signOut,
    isAdmin: profile?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthContext.Provider');
  }
  return context;
}
