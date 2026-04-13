'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
    { name: 'Mon', problems: 4 },
    { name: 'Tue', problems: 3 },
    { name: 'Wed', problems: 7 },
    { name: 'Thu', problems: 5 },
    { name: 'Fri', problems: 8 },
    { name: 'Sat', problems: 12 },
    { name: 'Sun', problems: 9 },
];

interface ActivityGraphProps {
    data: { name: string; problems: number }[];
}

export function ActivityGraph({ data = [] }: ActivityGraphProps) {
    // Default empty data if none provided (e.g. for guest users)
    const chartData = data.length > 0 ? data : [
        { name: 'Mon', problems: 0 },
        { name: 'Tue', problems: 0 },
        { name: 'Wed', problems: 0 },
        { name: 'Thu', problems: 0 },
        { name: 'Fri', problems: 0 },
        { name: 'Sat', problems: 0 },
        { name: 'Sun', problems: 0 },
    ];

    return (
        <div className="p-8 rounded-2xl bg-gray-900 border border-gray-800 h-[320px] w-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Activity</h3>
                <select className="bg-gray-800 text-gray-400 rounded-lg px-3 py-2 border border-gray-700 outline-none">
                    <option>This Week</option>
                    <option>Last Week</option>
                </select>
            </div>

            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={chartData}
                        margin={{
                            top: 10,
                            right: 10,
                            left: -20,
                            bottom: 0,
                        }}
                    >
                        <defs>
                            <linearGradient id="colorProblems" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="#666"
                            tick={{ fill: '#888', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#666"
                            tick={{ fill: '#888', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            cursor={{ stroke: '#333' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="problems"
                            stroke="#22c55e"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorProblems)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
