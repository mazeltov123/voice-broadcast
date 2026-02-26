import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

const COLORS = ['#10B981', '#EF4444', '#F59E0B'];

export default function BroadcastAnalytics({ broadcasts, inboundMessages }) {
  // Campaign performance data
  const campaignData = broadcasts.slice(0, 6).map(b => ({
    name: b.name.length > 15 ? b.name.substring(0, 15) + '...' : b.name,
    delivered: b.delivered || 0,
    failed: b.failed || 0,
    pending: b.pending || 0,
    total: b.total_recipients || 0,
    rate: b.total_recipients > 0 ? Math.round(((b.delivered || 0) / b.total_recipients) * 100) : 0,
  }));

  // Overall delivery stats
  const totalDelivered = broadcasts.reduce((acc, b) => acc + (b.delivered || 0), 0);
  const totalFailed = broadcasts.reduce((acc, b) => acc + (b.failed || 0), 0);
  const totalPending = broadcasts.reduce((acc, b) => acc + (b.pending || 0), 0);
  
  const deliveryData = [
    { name: 'Delivered', value: totalDelivered },
    { name: 'Failed', value: totalFailed },
    { name: 'Pending', value: totalPending },
  ].filter(d => d.value > 0);

  // Call duration averages
  const avgDuration = inboundMessages.length > 0
    ? Math.round(inboundMessages.reduce((acc, m) => acc + (m.duration_seconds || 0), 0) / inboundMessages.length)
    : 0;

  // Engagement metrics
  const newMessages = inboundMessages.filter(m => m.status === 'new').length;
  const reviewedMessages = inboundMessages.filter(m => m.status === 'reviewed').length;
  
  const overallDeliveryRate = (totalDelivered + totalFailed) > 0
    ? Math.round((totalDelivered / (totalDelivered + totalFailed)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Delivery Rate</p>
                <p className="text-2xl font-bold">{overallDeliveryRate}%</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                {overallDeliveryRate >= 90 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-amber-600" />
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {totalDelivered} of {totalDelivered + totalFailed} calls successful
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Call Duration</p>
                <p className="text-2xl font-bold">{avgDuration}s</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Across {inboundMessages.length} inbound calls
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Engagement</p>
                <p className="text-2xl font-bold">{newMessages}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Activity className="h-5 w-5 text-violet-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              New messages awaiting review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Performance */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {campaignData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={campaignData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="delivered" fill="#10B981" name="Delivered" />
                  <Bar dataKey="failed" fill="#EF4444" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No campaign data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Distribution */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Overall Delivery Status</CardTitle>
          </CardHeader>
          <CardContent>
            {deliveryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={deliveryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {deliveryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No delivery data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Rate Trend */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Delivery Success Rate by Campaign</CardTitle>
          </CardHeader>
          <CardContent>
            {campaignData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={campaignData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} domain={[0, 100]} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="rate" stroke="#3B82F6" strokeWidth={2} name="Success Rate (%)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No campaign data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inbound Call Stats */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Inbound Message Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-primary"></div>
                  <span className="text-sm">New Messages</span>
                </div>
                <span className="text-lg font-semibold">{newMessages}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-slate-400"></div>
                  <span className="text-sm">Reviewed</span>
                </div>
                <span className="text-lg font-semibold">{reviewedMessages}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-slate-300"></div>
                  <span className="text-sm">Archived</span>
                </div>
                <span className="text-lg font-semibold">
                  {inboundMessages.filter(m => m.status === 'archived').length}
                </span>
              </div>
              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Total Inbound</span>
                  <span className="text-xl font-bold text-primary">{inboundMessages.length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}