export interface CreateClientDto {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  tags?: string[];
  groupIds?: string[];
}

export interface UpdateClientDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  tags?: string[];
  isActive?: boolean;
  groupIds?: string[];
}

export interface ClientFilters {
  search?: string;
  tags?: string[];
  groupId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; phone: string; error: string }>;
  clients: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  }>;
}
