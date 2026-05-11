import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
        <p className="font-semibold text-sm">{label}</p>

        <p className="text-blue-500 text-sm">
          Accuracy: {Number(payload[0].value).toFixed(1)}%
        </p>
      </div>
    );
  }

  return null;
};

const EnhancedBarChart = ({ bars }) => {
  const normalizedData = bars.map((item) => ({
    ...item,
    value: Number(item.value).toFixed(1),
  }));

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart
          data={normalizedData}
          margin={{ top: 30, right: 20, left: 10, bottom: 70 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />

          <XAxis
            dataKey="label"
            angle={-25}
            textAnchor="end"
            interval={0}
            tick={{ fontSize: 12 }}
          />

          <YAxis tickFormatter={(value) => `${value}%`} domain={[0, 100]} />

          <Tooltip content={<CustomTooltip />} />

          <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={800}>
            <LabelList
              dataKey="value"
              position="top"
              formatter={(value) => `${value}%`}
            />

            {normalizedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={`hsl(${index * 45}, 70%, 55%)`}
              />
            ))}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EnhancedBarChart;
