// Heatmap Details Modal Component

import React, { useState } from 'react';
import {
  X,
  MapPin,
  Package,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  Tag,
  MapPinned,
  Plus,
  Trash2,
  Save,
  Lock,
} from 'lucide-react';
import type { HeatmapArea, LocalFisico } from '../lib/heatmapTypes';
import {
  getCriticalityLevel,
  getCriticalityBgClass,
  getCriticalityTextClass,
  calculatePending,
  formatDateTime,
} from '../lib/heatmapUtils';

interface HeatmapDetailsModalProps {
  area: HeatmapArea | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestAdminAccess: () => void;
  isAdmin: boolean;
  onSaveLocais: (areaId: string, locais: LocalFisico[]) => void;
}

export const HeatmapDetailsModal: React.FC<HeatmapDetailsModalProps> = ({
  area,
  isOpen,
  onClose,
  onRequestAdminAccess,
  isAdmin,
  onSaveLocais,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [locaisEditados, setLocaisEditados] = useState<LocalFisico[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  if (!isOpen || !area) return null;

  const criticality = getCriticalityLevel(area);
  const bgClass = getCriticalityBgClass(criticality);
  const textClass = getCriticalityTextClass(criticality);
  const pending = calculatePending(area.totalSku, area.concluidos);

  const handleStartEdit = () => {
    if (isAdmin) {
      setLocaisEditados([...area.locaisFisicos]);
      setEditMode(true);
      setHasChanges(false);
    } else {
      onRequestAdminAccess();
    }
  };

  const handleAddLocal = () => {
    setLocaisEditados([
      ...locaisEditados,
      {
        id: `lf-new-${Date.now()}`,
        nome: '',
        descricao: '',
      },
    ]);
    setHasChanges(true);
  };

  const handleRemoveLocal = (index: number) => {
    setLocaisEditados(locaisEditados.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleLocalChange = (index: number, field: 'nome' | 'descricao', value: string) => {
    const novos = [...locaisEditados];
    novos[index] = { ...novos[index], [field]: value };
    setLocaisEditados(novos);
    setHasChanges(true);
  };

  const handleSave = () => {
    const locaisValidos = locaisEditados.filter(l => l.nome.trim() !== '').map((l, i) => ({
      ...l,
      id: l.id || `lf-${area.id}-${i + 1}`,
    }));
    onSaveLocais(area.id, locaisValidos);
    setEditMode(false);
    setHasChanges(false);
  };

  const handleCancel = () => {
    setEditMode(false);
    setLocaisEditados([]);
    setHasChanges(false);
  };

  const criticalityLabels: Record<string, string> = {
    success: 'Saudável',
    warning: 'Atenção',
    danger: 'Risco',
    critical: 'Crítico',
    neutral: 'Não iniciado',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`${bgClass} border-b-2 p-5`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/50 rounded-lg">
                <MapPin size={24} className={textClass} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-800">{area.nome}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Tag size={14} className="text-zinc-500" />
                  <span className="text-sm text-zinc-500">{area.marcaNome}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full bg-white/50 ${textClass} font-medium`}>
                    {area.tipo.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/50 transition"
            >
              <X size={24} className="text-zinc-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Status Badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${bgClass} mb-4`}>
            {criticality === 'success' ? (
              <CheckCircle size={16} className="text-emerald-700" />
            ) : criticality === 'neutral' ? null : (
              <AlertTriangle size={16} className="text-red-700" />
            )}
            <span className={`font-medium ${textClass}`}>
              {criticalityLabels[criticality]}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-zinc-50 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1">Total de SKUs</p>
              <p className="text-2xl font-bold text-zinc-800">{area.totalSku}</p>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1">SKUs Contados</p>
              <p className="text-2xl font-bold text-zinc-800">{area.concluidos}</p>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1">Pendentes</p>
              <p className="text-2xl font-bold text-amber-600">{pending}</p>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1">Divergências</p>
              <p className={`text-2xl font-bold ${area.divergencias > 0 ? 'text-red-600' : 'text-zinc-400'}`}>
                {area.divergencias}
              </p>
            </div>
          </div>

          {/* Progress & Accuracy */}
          <div className="bg-zinc-50 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-500">Progresso</span>
                  <span className="font-bold text-zinc-800">{area.progresso.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(area.progresso, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-500">Acuracidade</span>
                  <span className={`font-bold ${textClass}`}>{area.acuracidade.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      area.acuracidade >= 90 ? 'bg-emerald-500' :
                      area.acuracidade >= 70 ? 'bg-amber-500' :
                      area.acuracidade >= 50 ? 'bg-orange-500' : 'bg-red-500'
                    } transition-all`}
                    style={{ width: `${Math.min(area.acuracidade, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Physical Locations */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-zinc-700 flex items-center gap-2">
                <MapPinned size={18} className="text-zinc-500" />
                Locais Físicos
              </h4>
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
              >
                {!isAdmin && <Lock size={12} />}
                {editMode ? 'Cancelar' : 'Editar'}
              </button>
            </div>

            {editMode ? (
              <div className="space-y-3">
                {locaisEditados.map((local, index) => (
                  <div key={local.id} className="bg-zinc-50 rounded-lg p-3">
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Nome do local (ex: Rua A)"
                        value={local.nome}
                        onChange={(e) => handleLocalChange(index, 'nome', e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleRemoveLocal(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Descrição (ex: Corredor principal, vão 3)"
                      value={local.descricao}
                      onChange={(e) => handleLocalChange(index, 'descricao', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
                <button
                  onClick={handleAddLocal}
                  disabled={locaisEditados.length >= 3}
                  className="w-full py-2 border-2 border-dashed border-zinc-300 rounded-lg text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-600 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={16} />
                  Adicionar local ({locaisEditados.length}/3)
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {area.locaisFisicos.length > 0 ? (
                  area.locaisFisicos.map((local) => (
                    <div
                      key={local.id}
                      className="bg-zinc-50 rounded-lg p-3 flex items-center gap-3"
                    >
                      <MapPin size={16} className="text-zinc-400" />
                      <div>
                        <p className="font-medium text-zinc-800">{local.nome}</p>
                        {local.descricao && (
                          <p className="text-sm text-zinc-500">{local.descricao}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500 italic">
                    Nenhum local físico cadastrado. Clique em Editar para adicionar.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Divergent Products */}
          {area.produtosDivergentes.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                Produtos Divergentes
              </h4>
              <div className="bg-red-50 rounded-xl p-3">
                <div className="flex flex-wrap gap-2">
                  {area.produtosDivergentes.map((sku, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-red-100 text-red-700 text-xs font-mono rounded"
                    >
                      {sku}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="bg-zinc-50 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-500 mb-1 flex items-center gap-1">
                  <User size={14} />
                  Responsável
                </p>
                <p className="font-medium text-zinc-800">{area.responsavel || 'Não definido'}</p>
              </div>
              <div>
                <p className="text-zinc-500 mb-1 flex items-center gap-1">
                  <Clock size={14} />
                  Última atualização
                </p>
                <p className="font-medium text-zinc-800">{formatDateTime(area.ultimaAtualizacao)}</p>
              </div>
            </div>
            {area.observacoes && (
              <div className="mt-4 pt-4 border-t border-zinc-200">
                <p className="text-zinc-500 mb-1">Observações</p>
                <p className="text-sm text-zinc-700">{area.observacoes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {editMode && (
          <div className="border-t border-zinc-200 p-4 bg-zinc-50 flex justify-between">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-zinc-600 hover:bg-zinc-200 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              Salvar alterações
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
