'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
    { name: 'Week 1', score: 1200 },
    { name: 'Week 2', score: 1350 },
    { name: 'Week 3', score: 1280 },
    { name: 'Week 4', score: 1450 },
    { name: 'Week 5', score: 1580 },
    { name: 'Week 6', score: 1750 },
    { name: 'Week 7', score: 1900 },
];

interface ScoreGraphProps {
    data?: { name: string; score: number }[];
}

export function ScoreGraph({ data = [] }: ScoreGraphProps) {
    // Determine fallback data only if no data at all
    const chartData = data.length > 0 ? data : [
        { name: 'Start', score: 1000 },
        { name: 'Current', score: 1000 },
    ];

    return (
        <div className="p-8 rounded-2xl bg-gray-900 border border-gray-800 h-[320px] w-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Performance Score</h3>
                <select className="bg-gray-800 text-gray-400 rounded-lg px-3 py-2 border border-gray-700 outline-none">
                    <option>Last 7 Weeks</option>
                    <option>Last Month</option>
                </select>
            </div>

            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{
                            top: 10,
                            right: 10,
                            left: -10,
                            bottom: 0,
                        }}
                    >
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
                            domain={['dataMin - 100', 'dataMax + 100']}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            cursor={{ stroke: '#333' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#eab308"
                            strokeWidth={3}
                            dot={{ fill: '#eab308', r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
