// Heatmap Utilities

import type { HeatmapArea, HeatmapStats, CriticalityLevel, HeatmapFilters, BrandData } from './heatmapTypes';

// Calculate progress percentage
export const calculateProgress = (concluidos: number, totalSku: number): number => {
  if (totalSku === 0) return 0;
  return (concluidos / totalSku) * 100;
};

// Calculate accuracy percentage
export const calculateAccuracy = (concluidos: number, divergencias: number): number => {
  if (concluidos === 0) return 0;
  return ((concluidos - divergencias) / concluidos) * 100;
};

// Calculate pending SKUs
export const calculatePending = (totalSku: number, concluidos: number): number => {
  return totalSku - concluidos;
};

// Determine criticality level based on accuracy and divergences
export const getCriticalityLevel = (area: HeatmapArea): CriticalityLevel => {
  if (area.progresso === 0) return 'neutral';

  const divThreshold = Math.max(area.totalSku * 0.08, 10);

  if (area.acuracidade >= 90 && area.divergencias < divThreshold) {
    return 'success';
  } else if (area.acuracidade >= 70 && area.acuracidade < 90) {
    return 'warning';
  } else if (area.acuracidade >= 50 && area.acuracidade < 70) {
    return 'danger';
  } else {
    return 'critical';
  }
};

// Get background color class based on criticality
export const getCriticalityBgClass = (level: CriticalityLevel): string => {
  switch (level) {
    case 'success': return 'bg-emerald-100 border-emerald-300';
    case 'warning': return 'bg-amber-100 border-amber-300';
    case 'danger': return 'bg-orange-100 border-orange-300';
    case 'critical': return 'bg-red-100 border-red-300';
    case 'neutral': return 'bg-zinc-100 border-zinc-300';
    default: return 'bg-zinc-100 border-zinc-300';
  }
};

// Get text color class based on criticality
export const getCriticalityTextClass = (level: CriticalityLevel): string => {
  switch (level) {
    case 'success': return 'text-emerald-700';
    case 'warning': return 'text-amber-700';
    case 'danger': return 'text-orange-700';
    case 'critical': return 'text-red-700';
    case 'neutral': return 'text-zinc-500';
    default: return 'text-zinc-700';
  }
};

// Get progress bar class
export const getProgressBgClass = (level: CriticalityLevel): string => {
  switch (level) {
    case 'success': return 'bg-emerald-500';
    case 'warning': return 'bg-amber-500';
    case 'danger': return 'bg-orange-500';
    case 'critical': return 'bg-red-500';
    case 'neutral': return 'bg-zinc-400';
    default: return 'bg-zinc-400';
  }
};

// Filter heatmap areas
export const filterHeatmapAreas = (areas: HeatmapArea[], filters: HeatmapFilters): HeatmapArea[] => {
  let filtered = [...areas];

  // Search filter
  if (filters.busca) {
    const search = filters.busca.toLowerCase();
    filtered = filtered.filter(area =>
      area.nome.toLowerCase().includes(search) ||
      area.marcaNome?.toLowerCase().includes(search) ||
      area.responsavel.toLowerCase().includes(search)
    );
  }

  // Status filter
  if (filters.status !== 'all') {
    filtered = filtered.filter(area => {
      if (filters.status === 'concluido') return area.progresso === 100;
      if (filters.status === 'andamento') return area.progresso > 0 && area.progresso < 100;
      if (filters.status === 'pendente') return area.progresso === 0;
      return true;
    });
  }

  // Brand filter
  if (filters.marca) {
    filtered = filtered.filter(area => area.marcaId === filters.marca);
  }

  // Criticality filter
  if (filters.criticidade !== 'all') {
    filtered = filtered.filter(area => getCriticalityLevel(area) === filters.criticidade);
  }

  // Sorting
  filtered.sort((a, b) => {
    switch (filters.ordenacao) {
      case 'divergencia_desc':
        return b.divergencias - a.divergencias;
      case 'acuracidade_asc':
        return a.acuracidade - b.acuracidade;
      case 'progresso_desc':
        return b.progresso - a.progresso;
      case 'nome':
      default:
        return a.nome.localeCompare(b.nome);
    }
  });

  return filtered;
};

// Calculate heatmap statistics
export const calculateHeatmapStats = (areas: HeatmapArea[]): HeatmapStats => {
  const totalAreas = areas.length;
  const areasCriticas = areas.filter(a => {
    const level = getCriticalityLevel(a);
    return level === 'critical' || level === 'danger';
  }).length;
  const areasSaudaveis = areas.filter(a => getCriticalityLevel(a) === 'success').length;
  const areasNaoIniciadas = areas.filter(a => a.progresso === 0).length;

  // Find highest risk area
  const areasWithProgress = areas.filter(a => a.progresso > 0);
  let maiorPontoRisco: string | null = null;
  if (areasWithProgress.length > 0) {
    const sorted = [...areasWithProgress].sort((a, b) => a.acuracidade - b.acuracidade);
    if (sorted[0] && sorted[0].acuracidade < 70) {
      maiorPontoRisco = sorted[0].nome;
    }
  }

  const totalDivergencias = areas.reduce((sum, a) => sum + a.divergencias, 0);
  const avgTotal = areas.reduce((sum, a) => sum + a.acuracidade, 0);
  const avgAreas = areas.filter(a => a.progresso > 0);
  const mediaAcuracidade = avgAreas.length > 0
    ? avgAreas.reduce((sum, a) => sum + a.acuracidade, 0) / avgAreas.length
    : 0;

  return {
    areasCriticas,
    areasSaudaveis,
    areasNaoIniciadas,
    maiorPontoRisco,
    mediaAcuracidade,
    totalAreas,
    totalDivergencias
  };
};

// Generate mock heatmap data from brands
export const generateMockHeatmapData = (brands: BrandData[]): HeatmapArea[] => {
  return brands.map((brand, index) => {
    const concluidos = brand.done_sku;
    const totalSku = brand.total_sku;
    const divergencias = brand.divergences;
    const progresso = calculateProgress(concluidos, totalSku);
    const acuracidade = calculateAccuracy(concluidos, divergencias);

    const locaisFisicos: { id: string; nome: string; descricao: string }[] = [];

    // Generate mock physical locations based on brand
    const ruas = ['A', 'B', 'C', 'D'];
    const ruaBase = ruas[index % ruas.length];
    const vao = Math.floor(index / 2) + 1;

    const tipos = ['linha', 'rua', 'vao', 'setor', 'excesso'] as const;

    return {
      id: `area-${brand.id}`,
      nome: brand.brand,
      tipo: tipos[index % tipos.length],
      marcaId: brand.id,
      marcaNome: brand.brand,
      totalSku,
      concluidos,
      divergencias,
      acuracidade: parseFloat(acuracidade.toFixed(1)),
      progresso: parseFloat(progresso.toFixed(1)),
      responsavel: ['Ana', 'João', 'Maria', 'Carlos', 'Pedro', 'Lucia'][index % 6],
      ultimaAtualizacao: brand.updated_at || new Date().toISOString(),
      observacoes: '',
      produtosDivergentes: divergencias > 0
        ? Array(Math.min(divergencias, 5)).fill(0).map((_, i) => `SKU-${brand.brand.slice(0, 3).toUpperCase()}-${1000 + i}`)
        : [],
      locaisFisicos: locaisFisicos.length > 0 ? locaisFisicos : [
        { id: `lf-${brand.id}-1`, nome: `Rua ${ruaBase}`, descricao: `Corredor principal, vao ${vao}` },
        { id: `lf-${brand.id}-2`, nome: `Vão ${vao}`, descricao: `Altura: 3 prateleiras` },
        { id: `lf-${brand.id}-3`, nome: `Prateleira ${vao + 1}`, descricao: `Estoque de reserva` }
      ]
    };
  });
};

// Format date for display
export const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'N/A';
  }
};
