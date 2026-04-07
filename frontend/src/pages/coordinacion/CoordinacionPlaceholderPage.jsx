import CoordinacionLayout from "../../components/coordinacion/CoordinacionLayout";
import { Users, ClipboardList, Presentation, Calendar, BarChart3, Construction } from "lucide-react";

const ICON_MAP = {
  Users,
  ClipboardList,
  Presentation,
  Calendar,
  BarChart3,
  Construction,
};

export default function CoordinacionPlaceholderPage({ title, iconName, description, user, token, onLogout, activeSection }) {
  const Icon = ICON_MAP[iconName] || Construction;

  return (
    <CoordinacionLayout user={user} token={token} onLogout={onLogout} activeSection={activeSection}>
      <div className="flex flex-col items-center justify-center py-24 text-center" data-testid={`placeholder-${activeSection}`}>
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-700 mb-2">{title}</h2>
        <p className="text-sm text-slate-400 max-w-md">{description}</p>
        <span className="mt-4 px-3 py-1 bg-amber-50 text-amber-600 text-xs font-medium rounded-full">Proximamente</span>
      </div>
    </CoordinacionLayout>
  );
}
