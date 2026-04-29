import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PendingOrders } from '../components/admin/PendingOrders';
import { CompleteOrders } from '../components/admin/CompleteOrders';
import { supabase } from '../lib/supabase';

export function CashierPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [currentMonthIncome, setCurrentMonthIncome] = useState(0);
  const [currentMonthOrders, setCurrentMonthOrders] = useState(0);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCurrentMonthIncome();

    const subscription = supabase
      .channel('cashier-income')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_income' }, () => {
        fetchCurrentMonthIncome();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        fetchCurrentMonthIncome();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchCurrentMonthIncome = async () => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const { data, error } = await supabase
        .from('monthly_income')
        .select('*')
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCurrentMonthIncome(Number(data.total_income));
        setCurrentMonthOrders(data.total_orders);
      } else {
        setCurrentMonthIncome(0);
        setCurrentMonthOrders(0);
      }
    } catch (error) {
      console.error('Error fetching income:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login/cashier');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const monthName = new Date().toLocaleString('en-PH', { month: 'long' });
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <img src="/180fdd1f-21ad-41df-89f8-a837bb6c7940-Photoroom.png" alt="MR. CHANGE" className="w-12 h-12 sm:w-14 sm:h-14" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">MR. CHANGE</h1>
                <p className="text-xs sm:text-sm text-gray-600">Cashier Panel</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-700">{profile?.full_name}</p>
                <p className="text-xs text-gray-500">Cashier</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 bg-red-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg hover:bg-red-700 transition font-semibold text-sm sm:text-base"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Current Month Income Card */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl shadow-xl p-5 sm:p-6 mb-6 sm:mb-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium opacity-90">Net Income - {monthName} {currentYear}</p>
                <p className="text-2xl sm:text-3xl font-bold">
                  {currentMonthIncome.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-90">Completed Orders</p>
              <p className="text-xl sm:text-2xl font-bold">{currentMonthOrders}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition ${
              activeTab === 'pending'
                ? 'bg-yellow-500 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Pending Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition ${
              activeTab === 'completed'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Completed Orders</span>
          </button>
        </div>

        {activeTab === 'pending' && <PendingOrders />}
        {activeTab === 'completed' && <CompleteOrders />}
      </main>
    </div>
  );
}
