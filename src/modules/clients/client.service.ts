import * as XLSX from 'xlsx';
import { prisma } from '../../shared/config/prisma';
import { NotFoundError, ConflictError, ValidationError } from '../../shared/utils/errors';
import { buildPaginationMeta } from '../../shared/utils/response';
import {
  CreateClientDto,
  UpdateClientDto,
  ClientFilters,
  BulkImportResult,
} from './client.types';
import { logger } from '../../shared/utils/logger';

export class ClientService {
  async create(dto: CreateClientDto) {
    const existing = await prisma.client.findUnique({ where: { phone: dto.phone } });
    if (existing) {
      throw new ConflictError(`Phone number ${dto.phone} is already registered`);
    }

    const client = await prisma.client.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        tags: dto.tags || [],
        groups: dto.groupIds
          ? {
              create: dto.groupIds.map((groupId) => ({ groupId })),
            }
          : undefined,
      },
      include: { groups: { include: { group: true } } },
    });

    return client;
  }

  async findAll(filters: ClientFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters.groupId) {
      where.groups = { some: { groupId: filters.groupId } };
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          groups: { include: { group: { select: { id: true, name: true, color: true } } } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return {
      clients,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findById(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        groups: { include: { group: true } },
        smsLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { campaign: { select: { id: true, name: true } } },
        },
      },
    });

    if (!client) throw new NotFoundError('Client');
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findById(id);

    if (dto.phone) {
      const existing = await prisma.client.findFirst({
        where: { phone: dto.phone, NOT: { id } },
      });
      if (existing) throw new ConflictError('Phone number already in use');
    }

    // Separate groupIds from other fields
    const { groupIds, ...updateData } = dto;

    const data: Record<string, unknown> = { ...updateData };

    // Handle groups relation update
    if (groupIds) {
      // First, disconnect all existing groups by deleting associations
      await prisma.clientGroup.deleteMany({
        where: { clientId: id },
      });

      // Then create new group associations
      data.groups = {
        create: groupIds.map((groupId) => ({ groupId })),
      };
    }

    return prisma.client.update({
      where: { id },
      data,
      include: { groups: { include: { group: true } } },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.client.delete({ where: { id } });
  }

  async addToGroup(clientId: string, groupId: string) {
    const [client, group] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.group.findUnique({ where: { id: groupId } }),
    ]);

    if (!client) throw new NotFoundError('Client');
    if (!group) throw new NotFoundError('Group');

    const existing = await prisma.clientGroup.findUnique({
      where: { clientId_groupId: { clientId, groupId } },
    });

    if (existing) throw new ConflictError('Client already in this group');

    return prisma.clientGroup.create({ data: { clientId, groupId } });
  }

  async removeFromGroup(clientId: string, groupId: string) {
    const existing = await prisma.clientGroup.findUnique({
      where: { clientId_groupId: { clientId, groupId } },
    });

    if (!existing) throw new NotFoundError('Client group association');

    await prisma.clientGroup.delete({
      where: { clientId_groupId: { clientId, groupId } },
    });
  }

  async bulkImport(fileBuffer: Buffer, groupId?: string): Promise<BulkImportResult> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    if (rows.length === 0) {
      throw new ValidationError('Excel file is empty or has no valid rows');
    }

    const result: BulkImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      clients: [],
    };

    // Validate group if provided
    if (groupId) {
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group) throw new NotFoundError('Group');
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row (header = 1, data starts at 2)

      try {
        const phone = String(
          row['phone'] || row['Phone'] || row['telephone'] || row['Telephone'] || ''
        ).trim();
        const firstName = String(
          row['firstName'] || row['FirstName'] || row['first_name'] || row['Prénom'] || ''
        ).trim();
        const lastName = String(
          row['lastName'] || row['LastName'] || row['last_name'] || row['Nom'] || ''
        ).trim();
        const email = String(
          row['email'] || row['Email'] || ''
        ).trim() || undefined;

        if (!phone) {
          result.errors.push({ row: rowNum, phone: 'N/A', error: 'Phone number is required' });
          result.failed++;
          continue;
        }

        if (!firstName) {
          result.errors.push({ row: rowNum, phone, error: 'First name is required' });
          result.failed++;
          continue;
        }

        const client = await prisma.client.upsert({
          where: { phone },
          create: {
            firstName,
            lastName: lastName || firstName,
            phone,
            email: email || undefined,
            groups: groupId ? { create: [{ groupId }] } : undefined,
          },
          update: {
            firstName,
            lastName: lastName || firstName,
            email: email || undefined,
          },
        });

        result.clients.push({
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          phone: client.phone,
        });
        result.success++;
      } catch (err) {
        logger.error(`Bulk import row ${rowNum} error:`, err);
        result.errors.push({
          row: rowNum,
          phone: String(row['phone'] || 'N/A'),
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        result.failed++;
      }
    }

    return result;
  }

  async exportToExcel(): Promise<Buffer> {
    const clients = await prisma.client.findMany({
      where: { isActive: true },
      include: {
        groups: { include: { group: { select: { name: true } } } },
      },
      orderBy: { lastName: 'asc' },
    });

    const data = clients.map((c) => ({
      'ID': c.id,
      'Prénom': c.firstName,
      'Nom': c.lastName,
      'Téléphone': c.phone,
      'Email': c.email || '',
      'Tags': c.tags.join(', '),
      'Groupes': c.groups.map((cg) => cg.group.name).join(', '),
      'Actif': c.isActive ? 'Oui' : 'Non',
      'Date inscription': c.createdAt.toLocaleDateString('fr-FR'),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Column widths
    worksheet['!cols'] = [
      { wch: 36 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 8 }, { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  async getStats() {
    const [total, active, inactive, byGroup] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { isActive: true } }),
      prisma.client.count({ where: { isActive: false } }),
      prisma.group.findMany({
        select: {
          id: true,
          name: true,
          color: true,
          _count: { select: { clients: true } },
        },
      }),
    ]);

    return { total, active, inactive, byGroup };
  }
}
