// Heatmap Types

export type AreaType = 'linha' | 'rua' | 'vao' | 'setor' | 'excesso';

export type CriticalityLevel = 'success' | 'warning' | 'danger' | 'critical' | 'neutral';

export type ViewMode = 'grid' | 'list' | 'ranking';

export type StatusFilter = 'all' | 'concluido' | 'andamento' | 'pendente';

export type SortOption = 'divergencia_desc' | 'acuracidade_asc' | 'progresso_desc' | 'nome';

export interface HeatmapArea {
  id: string;
  nome: string;
  tipo: AreaType;
  marcaId?: string;
  marcaNome?: string;
  totalSku: number;
  concluidos: number;
  divergencias: number;
  acuracidade: number;
  progresso: number;
  responsavel: string;
  ultimaAtualizacao: string;
  observacoes: string;
  produtosDivergentes: string[];
  locaisFisicos: LocalFisico[];
}

export interface LocalFisico {
  id: string;
  nome: string;
  descricao: string;
}

export interface HeatmapFilters {
  status: StatusFilter;
  marca: string;
  criticidade: CriticalityLevel | 'all';
  ordenacao: SortOption;
  busca: string;
}

export interface HeatmapStats {
  areasCriticas: number;
  areasSaudaveis: number;
  areasNaoIniciadas: number;
  maiorPontoRisco: string | null;
  mediaAcuracidade: number;
  totalAreas: number;
  totalDivergencias: number;
}
