import { TrendingUp, Clock, Landmark } from "lucide-react";

const formatNumber = (n) => {
  if (n == null) return "0.00";
  return Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function AccountingSummaryCards({ summary, loading }) {
  const cards = [
    {
      title: "Ingresos del periodo",
      value: summary?.total_income ?? 0,
      icon: TrendingUp,
      gradient: "from-emerald-500 to-teal-600",
      valueColor: "text-emerald-700",
      borderColor: "border-l-emerald-500",
      shadow: "shadow-emerald-500/20",
      testId: "summary-card-income"
    },
    {
      title: "Total Adeudado",
      value: summary?.total_pending ?? 0,
      icon: Clock,
      gradient: "from-amber-400 to-orange-500",
      valueColor: "text-amber-700",
      borderColor: "border-l-amber-500",
      shadow: "shadow-amber-500/20",
      testId: "summary-card-pending"
    },
    {
      title: "Total General",
      value: summary?.total_general ?? 0,
      icon: Landmark,
      gradient: "from-blue-600 to-indigo-700",
      valueColor: "text-blue-700",
      borderColor: "border-l-blue-600",
      shadow: "shadow-blue-500/20",
      testId: "summary-card-general"
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl p-5 animate-pulse shadow-sm border border-gray-100 border-l-4 border-l-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-xl" />
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-7 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="accounting-summary-cards">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.testId}
            className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 ${card.borderColor} hover:shadow-md transition-all duration-300`}
            data-testid={card.testId}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center shadow-lg ${card.shadow} flex-shrink-0`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">{card.title}</p>
                <p className={`text-2xl font-bold ${card.valueColor} tracking-tight`}>
                  S/ {formatNumber(card.value)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
