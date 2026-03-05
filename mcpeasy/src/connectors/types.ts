export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: {
    table: string;
    column: string;
  };
  defaultValue?: string;
}

export interface TableSchema {
  name: string;
  schema: string;
  columns: ColumnSchema[];
  rowCountEstimate: number;
}

export interface DataSourceSchema {
  sourceType: string;
  sourceName: string;
  tables: TableSchema[];
  metadata: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface Connector {
  name: string;
  type: 'database' | 'api';
  description: string;
  status: 'stable' | 'beta' | 'coming-soon';
  validateOptions(options: any): ValidationResult;
  introspect(options: any): Promise<DataSourceSchema>;
}
