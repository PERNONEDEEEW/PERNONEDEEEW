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
  const isFetchingRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string, retries = 5): Promise<Profile | null> => {
    if (isFetchingRef.current) return null;
    isFetchingRef.current = true;

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

      // Profile not found after all retries
      setProfile(null);
      return null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      return null;
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Load profile whenever user changes
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      const prof = await fetchProfile(user.id);
      if (cancelled) return;

      if (!prof) {
        // Profile fetch failed after retries - sign out to force re-login
        console.error('Profile not found for user, signing out');
        await supabase.auth.signOut();
      }
      setLoading(false);
    };

    setLoading(true);
    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user, fetchProfile]);

  // Initialize auth and listen for state changes
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        setUser(session?.user ?? null);
        if (!session?.user) {
          setLoading(false);
          setInitializing(false);
        }
        // If there IS a user, the profile useEffect above will handle it
        // and set loading=false when done
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

      if (event === 'INITIAL_SESSION') {
        // Already handled by getSession above
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        // Just update the user reference, don't touch profile or loading
        setUser(session?.user ?? null);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        setInitializing(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        const userId = session?.user?.id ?? null;
        setUser(session?.user ?? null);
        // The profile useEffect will detect the user change and fetch profile
        setInitializing(false);
        return;
      }

      // For any other event, just update user
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Mark initialization complete once we have both user and profile (or no user)
  useEffect(() => {
    if (initializing) {
      if (!user || profile) {
        setInitializing(false);
      }
    }
  }, [user, profile, initializing]);

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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
