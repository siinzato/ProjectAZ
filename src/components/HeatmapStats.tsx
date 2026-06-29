// Heatmap Stats Component

import React from 'react';
import {
  AlertTriangle,
  CheckCircle,
  MinusCircle,
  TrendingDown,
  Target,
  Layers,
} from 'lucide-react';
import type { HeatmapStats } from '../lib/heatmapTypes';

interface HeatmapStatsProps {
  stats: HeatmapStats;
}

export const HeatmapStatsComponent: React.FC<HeatmapStatsProps> = ({ stats }) => {
  const statCards = [
    {
      title: 'Áreas Críticas',
      value: stats.areasCriticas,
      subtitle: 'Precisam de atenção urgente',
      icon: AlertTriangle,
      color: 'bg-red-100 text-red-700',
      border: 'border-red-200',
    },
    {
      title: 'Áreas Saudáveis',
      value: stats.areasSaudaveis,
      subtitle: 'Com bom desempenho',
      icon: CheckCircle,
      color: 'bg-emerald-100 text-emerald-700',
      border: 'border-emerald-200',
    },
    {
      title: 'Não Iniciadas',
      value: stats.areasNaoIniciadas,
      subtitle: 'Aguardando contagem',
      icon: MinusCircle,
      color: 'bg-zinc-100 text-zinc-600',
      border: 'border-zinc-200',
    },
    {
      title: 'Maior Risco',
      value: stats.maiorPontoRisco || 'Nenhum',
      subtitle: 'Ponto crítico atual',
      icon: TrendingDown,
      color: 'bg-orange-100 text-orange-700',
      border: 'border-orange-200',
      isText: true,
    },
    {
      title: 'Média Acuracidade',
      value: `${stats.mediaAcuracidade.toFixed(1)}%`,
      subtitle: 'Média geral',
      icon: Target,
      color: stats.mediaAcuracidade >= 80 ? 'bg-emerald-100 text-emerald-700' :
             stats.mediaAcuracidade >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
      border: 'border-zinc-200',
    },
    {
      title: 'Total Áreas',
      value: stats.totalAreas,
      subtitle: `${stats.totalDivergencias} divergências`,
      icon: Layers,
      color: 'bg-blue-100 text-blue-700',
      border: 'border-blue-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {statCards.map((stat) => (
        <div
          key={stat.title}
          className={`bg-white rounded-xl shadow-sm border ${stat.border} p-4`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`p-2 rounded-lg ${stat.color}`}>
              <stat.icon size={18} />
            </div>
          </div>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
            {stat.title}
          </p>
          <p className={`text-xl font-bold ${stat.isText ? 'text-sm truncate' : ''} ${
            stat.color.includes('red') ? 'text-red-700' :
            stat.color.includes('emerald') ? 'text-emerald-700' :
            stat.color.includes('orange') ? 'text-orange-700' :
            stat.color.includes('blue') ? 'text-blue-700' :
            'text-zinc-700'
          }`}>
            {stat.value}
          </p>
          <p className="text-xs text-zinc-400 mt-1">{stat.subtitle}</p>
        </div>
      ))}
    </div>
  );
};
