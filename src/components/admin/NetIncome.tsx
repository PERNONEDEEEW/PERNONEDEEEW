import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Calendar, ShoppingBag, ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import { Database } from '../../lib/database.types';

type MonthlyIncome = Database['public']['Tables']['monthly_income']['Row'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function NetIncome() {
  const [incomeData, setIncomeData] = useState<MonthlyIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchIncomeData();

    const subscription = supabase
      .channel('monthly-income')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_income' }, () => {
        fetchIncomeData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        fetchIncomeData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedYear]);

  const fetchIncomeData = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_income')
        .select('*')
        .eq('year', selectedYear)
        .order('month', { ascending: true });

      if (error) throw error;
      setIncomeData(data || []);
    } catch (error) {
      console.error('Error fetching income data:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const currentMonthData = incomeData.find(d => d.month === currentMonth && d.year === currentYear);
  const currentMonthIncome = currentMonthData ? Number(currentMonthData.total_income) : 0;
  const currentMonthOrders = currentMonthData ? currentMonthData.total_orders : 0;

  const yearlyTotal = incomeData.reduce((sum, d) => sum + Number(d.total_income), 0);
  const yearlyOrders = incomeData.reduce((sum, d) => sum + d.total_orders, 0);

  const getMonthData = (month: number): MonthlyIncome | undefined => {
    return incomeData.find(d => d.month === month);
  };

  const isCurrentMonth = (month: number) => {
    return month === currentMonth && selectedYear === currentYear;
  };

  const isFutureMonth = (month: number) => {
    if (selectedYear > currentYear) return true;
    if (selectedYear === currentYear && month > currentMonth) return true;
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">Net Income</h2>
          <p className="text-gray-600 text-sm sm:text-base">Monthly income tracking - resets each new month</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl shadow-md px-4 py-2">
          <button
            onClick={() => setSelectedYear(selectedYear - 1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-lg font-bold text-gray-800 min-w-[80px] text-center">{selectedYear}</span>
          <button
            onClick={() => setSelectedYear(Math.min(selectedYear + 1, currentYear + 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Current Month Highlight */}
      {selectedYear === currentYear && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl shadow-xl p-6 sm:p-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold">₱</span>
            </div>
            <div>
              <p className="text-sm font-medium opacity-90">This Month's Net Income</p>
              <p className="text-xs opacity-75">{MONTH_NAMES[currentMonth - 1]} {currentYear}</p>
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-4xl sm:text-5xl font-bold mb-2">
                {currentMonthIncome.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
              </p>
              <p className="text-sm opacity-90">{currentMonthOrders} completed order{currentMonthOrders !== 1 ? 's' : ''} this month</p>
            </div>
            <div className="text-right">
              <div className="bg-white bg-opacity-20 rounded-xl px-4 py-3">
                <p className="text-xs opacity-90">Avg per Order</p>
                <p className="text-lg font-bold">
                  {currentMonthOrders > 0
                    ? (currentMonthIncome / currentMonthOrders).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
                    : '₱0.00'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Yearly Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-600">Yearly Total Income</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800">
            {yearlyTotal.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-blue-500">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-600">Yearly Completed Orders</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800">{yearlyOrders}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-amber-500">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-medium text-gray-600">Months with Income</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800">{incomeData.length}</p>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">Monthly Breakdown - {selectedYear}</h3>
          <p className="text-sm text-gray-500 mt-1">Each month starts fresh at zero</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0">
          {MONTH_NAMES.map((name, index) => {
            const month = index + 1;
            const data = getMonthData(month);
            const income = data ? Number(data.total_income) : 0;
            const orders = data ? data.total_orders : 0;
            const isCurrent = isCurrentMonth(month);
            const isFuture = isFutureMonth(month);
            const maxIncome = Math.max(...incomeData.map(d => Number(d.total_income)), 1);
            const barHeight = income > 0 ? Math.max((income / maxIncome) * 100, 8) : 0;

            return (
              <div
                key={month}
                className={`p-4 sm:p-5 border-b border-r border-gray-100 transition ${
                  isCurrent
                    ? 'bg-green-50 border-l-4 border-l-green-500'
                    : isFuture
                    ? 'bg-gray-50 opacity-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">{name}</span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-semibold">
                        Current
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{selectedYear}</span>
                </div>

                {/* Mini bar chart */}
                <div className="h-16 flex items-end mb-3">
                  <div className="w-full bg-gray-100 rounded-t-lg relative overflow-hidden" style={{ height: '100%' }}>
                    {income > 0 && (
                      <div
                        className={`absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-500 ${
                          isCurrent
                            ? 'bg-gradient-to-t from-green-600 to-green-400'
                            : 'bg-gradient-to-t from-red-600 to-red-400'
                        }`}
                        style={{ height: `${barHeight}%` }}
                      />
                    )}
                    {income === 0 && !isFuture && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-gray-400">No income</span>
                      </div>
                    )}
                    {isFuture && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-gray-400">Upcoming</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className={`text-lg font-bold ${income > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                    {income.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                  </p>
                  <p className="text-xs text-gray-500">{orders} order{orders !== 1 ? 's' : ''}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Income History Table */}
      {incomeData.length > 0 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-800">Income History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 sm:px-6 text-sm font-semibold text-gray-700">Month</th>
                  <th className="text-right py-3 px-4 sm:px-6 text-sm font-semibold text-gray-700">Net Income</th>
                  <th className="text-right py-3 px-4 sm:px-6 text-sm font-semibold text-gray-700">Orders</th>
                  <th className="text-right py-3 px-4 sm:px-6 text-sm font-semibold text-gray-700">Avg per Order</th>
                  <th className="text-right py-3 px-4 sm:px-6 text-sm font-semibold text-gray-700">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {incomeData
                  .sort((a, b) => b.month - a.month)
                  .map((data) => {
                    const income = Number(data.total_income);
                    const avgPerOrder = data.total_orders > 0 ? income / data.total_orders : 0;
                    return (
                      <tr key={data.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="py-3 px-4 sm:px-6">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold text-gray-800">
                              {MONTH_NAMES[data.month - 1]} {data.year}
                            </span>
                            {isCurrentMonth(data.month) && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-semibold">
                                Current
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 sm:px-6 text-right">
                          <span className="text-lg font-bold text-green-600">
                            {income.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                          </span>
                        </td>
                        <td className="py-3 px-4 sm:px-6 text-right">
                          <span className="font-semibold text-gray-700">{data.total_orders}</span>
                        </td>
                        <td className="py-3 px-4 sm:px-6 text-right">
                          <span className="text-sm text-gray-600">
                            {avgPerOrder.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                          </span>
                        </td>
                        <td className="py-3 px-4 sm:px-6 text-right text-sm text-gray-500">
                          {new Date(data.updated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
