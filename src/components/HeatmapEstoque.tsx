// Main Heatmap Component

import React, { useState, useMemo, useCallback } from 'react';
import { Grid3X3, List, BarChart3, Map, RefreshCw } from 'lucide-react';
import type { HeatmapArea, HeatmapFilters, ViewMode } from '../lib/heatmapTypes';
import { filterHeatmapAreas, calculateHeatmapStats, generateMockHeatmapData } from '../lib/heatmapUtils';
import { HeatmapFiltersComponent } from './HeatmapFilters';
import { HeatmapLegend } from './HeatmapLegend';
import { HeatmapCard } from './HeatmapCard';
import { HeatmapDetailsModal } from './HeatmapDetailsModal';
import { HeatmapStatsComponent } from './HeatmapStats';

interface HeatmapEstoqueProps {
  brandsData: Array<{
    id: string;
    brand: string;
    total_sku: number;
    done_sku: number;
    divergences: number;
    updated_at?: string;
  }>;
  onRequestAdminAccess: () => void;
  isAdmin: boolean;
  onLogout: () => void;
}

const defaultFilters: HeatmapFilters = {
  status: 'all',
  marca: '',
  criticidade: 'all',
  ordenacao: 'nome',
  busca: '',
};

export const HeatmapEstoque: React.FC<HeatmapEstoqueProps> = ({
  brandsData,
  onRequestAdminAccess,
  isAdmin,
  onLogout,
}) => {
  const [filters, setFilters] = useState<HeatmapFilters>(defaultFilters);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedArea, setSelectedArea] = useState<HeatmapArea | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [areas, setAreas] = useState<HeatmapArea[]>(() => generateMockHeatmapData(brandsData));

  // Generate heatmap data from brands
  const heatmapAreas = useMemo(() => {
    if (areas.length === 0 && brandsData.length > 0) {
      return generateMockHeatmapData(brandsData);
    }
    return areas;
  }, [brandsData, areas]);

  // Filter and sort areas
  const filteredAreas = useMemo(() => {
    return filterHeatmapAreas(heatmapAreas, filters);
  }, [heatmapAreas, filters]);

  // Calculate statistics
  const stats = useMemo(() => {
    return calculateHeatmapStats(heatmapAreas);
  }, [heatmapAreas]);

  // Get unique brands for filter
  const marcas = useMemo(() => {
    return Array.from(new Set(heatmapAreas.map(a => ({ id: a.marcaId || '', nome: a.marcaNome || a.nome }))))
      .filter(m => m.id && m.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [heatmapAreas]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<HeatmapFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Reset filters
  const handleResetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  // Handle area click
  const handleAreaClick = useCallback((area: HeatmapArea) => {
    setSelectedArea(area);
    setIsModalOpen(true);
  }, []);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedArea(null);
  }, []);

  // Handle save locais fisicos
  const handleSaveLocais = useCallback((areaId: string, locais: Array<{ id: string; nome: string; descricao: string }>) => {
    setAreas(prev => prev.map(area => {
      if (area.id === areaId) {
        return { ...area, locaisFisicos: locais };
      }
      return area;
    }));
  }, []);

  // Refresh data
  const handleRefresh = useCallback(() => {
    setAreas(generateMockHeatmapData(brandsData));
  }, [brandsData]);

  // View mode icons
  const viewModeIcons = {
    grid: Grid3X3,
    list: List,
    ranking: BarChart3,
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-xl">
            <Map size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-800">Heatmap do Estoque</h1>
            <p className="text-zinc-500">Visualize a saúde do seu estoque em um mapa interativo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <span className="text-sm text-emerald-600 font-medium bg-emerald-100 px-3 py-1 rounded-full">
              Admin
            </span>
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition text-sm font-medium text-zinc-700"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
          {isAdmin ? (
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition text-sm font-medium"
            >
              Sair do Admin
            </button>
          ) : (
            <button
              onClick={onRequestAdminAccess}
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition text-sm font-medium"
            >
              Acesso Admin
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <HeatmapStatsComponent stats={stats} />

      {/* Filters */}
      <HeatmapFiltersComponent
        filters={filters}
        onFilterChange={handleFilterChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        marcas={marcas}
        onReset={handleResetFilters}
      />

      {/* Legend */}
      <HeatmapLegend />

      {/* Results Count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">
          Mostrando <span className="font-semibold text-zinc-700">{filteredAreas.length}</span> de {heatmapAreas.length} áreas
        </p>
      </div>

      {/* Heatmap Grid/List/Ranking */}
      {filteredAreas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-12 text-center">
          <BarChart3 size={48} className="mx-auto text-zinc-300 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-700 mb-2">Nenhuma área encontrada</h3>
          <p className="text-zinc-500">Tente ajustar os filtros para ver mais resultados.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAreas.map((area) => (
            <HeatmapCard
              key={area.id}
              area={area}
              onClick={handleAreaClick}
              viewMode="grid"
            />
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredAreas.map((area) => (
            <HeatmapCard
              key={area.id}
              area={area}
              onClick={handleAreaClick}
              viewMode="list"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAreas
            .filter(a => a.progresso > 0)
            .sort((a, b) => a.acuracidade - b.acuracidade)
            .slice(0, 10)
            .map((area, index) => (
              <HeatmapCard
                key={area.id}
                area={area}
                onClick={handleAreaClick}
                viewMode="ranking"
                rank={index + 1}
              />
          ))}
        </div>
      )}

      {/* Details Modal */}
      <HeatmapDetailsModal
        area={selectedArea}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onRequestAdminAccess={onRequestAdminAccess}
        isAdmin={isAdmin}
        onSaveLocais={handleSaveLocais}
      />
    </div>
  );
};
