import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
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
  const profileIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchProfile = useCallback(async (userId: string, retries = 5): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data && retries > 0) {
        await new Promise(r => setTimeout(r, 300));
        return fetchProfile(userId, retries - 1);
      }

      if (mountedRef.current) {
        setProfile(data);
        profileIdRef.current = data?.id ?? null;
      }
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted) return;

        setUser(session?.user ?? null);
        if (session?.user) {
          const prof = await fetchProfile(session.user.id);
          // Only mark initialization complete and loading false after profile is resolved
          if (isMounted) {
            if (!prof) {
              // Profile fetch failed - clear user to force re-login
              setUser(null);
              setProfile(null);
              profileIdRef.current = null;
            }
            setLoading(false);
            setInitializing(false);
          }
        } else {
          setLoading(false);
          setInitializing(false);
        }
      } catch {
        if (isMounted) {
          setLoading(false);
          setInitializing(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      const userId = session?.user?.id ?? null;

      // On token refresh, just update the user reference - don't touch profile or loading
      if (event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
        return;
      }

      // On sign out, clear everything
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        profileIdRef.current = null;
        setLoading(false);
        return;
      }

      // On sign in or other events, update user and fetch profile if needed
      setUser(session?.user ?? null);
      if (userId && profileIdRef.current !== userId) {
        (async () => {
          const prof = await fetchProfile(userId);
          if (!isMounted) return;
          if (!prof) {
            setUser(null);
            setProfile(null);
            profileIdRef.current = null;
          }
          setLoading(false);
        })();
      }
    });

    return () => {
      isMounted = false;
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
      await fetchProfile(data.user.id);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'customer' } },
    });
    if (error) throw error;
    if (data.user) await fetchProfile(data.user.id);
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
    if (data.user) await fetchProfile(data.user.id);
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

    if (data.user) await fetchProfile(data.user.id);
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

    if (data.user) await fetchProfile(data.user.id);
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
    if (data.user) await fetchProfile(data.user.id);
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
