import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, Activity, AlertTriangle, Calendar } from 'lucide-react';
import { MedicalHistoryEntry } from './MedicalTimeline';
import { cn } from '@/utils';

interface MedicalProgressChartProps {
  entries: MedicalHistoryEntry[];
}

const riskLevelScore = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

export const MedicalProgressChart: React.FC<MedicalProgressChartProps> = ({ entries }) => {
  const chartData = useMemo(() => {
    if (entries.length === 0) return [];

    // Sort entries by date (oldest to newest for chart)
    const sortedEntries = [...entries].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Group by month and calculate average risk level
    const monthlyData = sortedEntries.reduce((acc, entry) => {
      const date = new Date(entry.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthLabel,
          date: monthKey,
          totalRisk: 0,
          count: 0,
          entries: [],
        };
      }

      acc[monthKey].totalRisk += riskLevelScore[entry.risk_level];
      acc[monthKey].count += 1;
      acc[monthKey].entries.push(entry);

      return acc;
    }, {} as Record<string, any>);

    // Calculate average risk and format data
    return Object.values(monthlyData).map((data: any) => ({
      month: data.month,
      date: data.date,
      avgRisk: Number((data.totalRisk / data.count).toFixed(2)),
      visitCount: data.count,
      entries: data.entries,
    }));
  }, [entries]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;

    const avgRisk = chartData.reduce((sum, d) => sum + d.avgRisk, 0) / chartData.length;
    const totalVisits = entries.length;
    const trend = chartData.length > 1 
      ? chartData[chartData.length - 1].avgRisk - chartData[0].avgRisk 
      : 0;

    return {
      avgRisk: avgRisk.toFixed(2),
      totalVisits,
      trend: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
      trendValue: Math.abs(trend).toFixed(2),
    };
  }, [chartData, entries]);

  if (entries.length === 0) {
    return (
      <Card className="border-2 border-dashed border-gray-200">
        <CardContent className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No data to display</p>
          <p className="text-xs text-gray-500 mt-1">Medical activity will be charted here</p>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-gray-900 mb-2">{data.month}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-gray-600">Avg Risk Score:</span>
              <span className="font-medium">{data.avgRisk}</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-gray-500" />
              <span className="text-gray-600">Visits:</span>
              <span className="font-medium">{data.visitCount}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              {stats && (
                <TrendingUp 
                  className={cn(
                    "w-3 h-3",
                    stats.trend === 'up' ? "text-red-600" : 
                    stats.trend === 'down' ? "text-green-600 rotate-180" : 
                    "text-gray-500"
                  )} 
                />
              )}
            </div>
            <p className="text-xs text-red-700 mb-1">Avg Risk</p>
            <p className="text-xl font-bold text-red-900">{stats?.avgRisk || '0'}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-4 pb-3">
            <Activity className="w-4 h-4 text-blue-600 mb-1" />
            <p className="text-xs text-blue-700 mb-1">Total Visits</p>
            <p className="text-xl font-bold text-blue-900">{stats?.totalVisits || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-4 pb-3">
            <Calendar className="w-4 h-4 text-purple-600 mb-1" />
            <p className="text-xs text-purple-700 mb-1">Months</p>
            <p className="text-xl font-bold text-purple-900">{chartData.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="overflow-hidden border-2 border-red-100">
        <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            Medical Progress Timeline
          </CardTitle>
          <CardDescription>Risk level trends over time</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#fee2e2" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12, fill: '#6b7280' }}
                stroke="#d1d5db"
              />
              <YAxis 
                domain={[0, 4]}
                ticks={[0, 1, 2, 3, 4]}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                stroke="#d1d5db"
                label={{ value: 'Risk Level', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 12 } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="avgRisk"
                stroke="#ef4444"
                strokeWidth={3}
                fill="url(#riskGradient)"
                animationDuration={1500}
              />
              <Line
                type="monotone"
                dataKey="avgRisk"
                stroke="#dc2626"
                strokeWidth={3}
                dot={{ 
                  fill: '#ef4444', 
                  strokeWidth: 3, 
                  r: 5,
                  stroke: '#fff'
                }}
                activeDot={{ 
                  r: 7, 
                  fill: '#dc2626',
                  stroke: '#fff',
                  strokeWidth: 3
                }}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-gradient-to-r from-green-500 to-yellow-500 rounded-full" />
                <span className="text-gray-600">0-2: Low-Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full" />
                <span className="text-gray-600">2-4: High-Critical</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

