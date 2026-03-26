import '../../tests/mocks';
import { ClientService } from './client.service';
import { ConflictError, NotFoundError } from '../../shared/utils/errors';
import { factories } from '../../../tests/helpers';
import * as XLSX from 'xlsx';

// Pull prisma mock AFTER mocks.ts has set it up
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma: mockPrisma } = require('src/shared/config/prisma');

describe('ClientService', () => {
  let clientService: ClientService;

  beforeEach(() => {
    clientService = new ClientService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new client', async () => {
      const dto = { firstName: 'Jean', lastName: 'Dupont', phone: '+221771234567', tags: ['vip'] };
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.client.create as jest.Mock).mockResolvedValue(factories.client(dto));

      const result = await clientService.create(dto);
      expect(result.phone).toBe(dto.phone);
      expect(mockPrisma.client.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictError if phone already exists', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(factories.client());

      await expect(
        clientService.create({ firstName: 'Test', lastName: 'User', phone: '+221771234567' })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('findAll', () => {
    it('should return paginated clients', async () => {
      const clients = [factories.client(), factories.client({ id: 'c2', phone: '+221770000001' })];
      (mockPrisma.client.findMany as jest.Mock).mockResolvedValue(clients);
      (mockPrisma.client.count as jest.Mock).mockResolvedValue(2);

      const result = await clientService.findAll({ page: 1, limit: 20 });
      expect(result.clients).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should pass search filter to Prisma', async () => {
      (mockPrisma.client.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.client.count as jest.Mock).mockResolvedValue(0);

      await clientService.findAll({ search: 'Jean' });
      const call = (mockPrisma.client.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
    });

    it('should filter by isActive', async () => {
      (mockPrisma.client.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.client.count as jest.Mock).mockResolvedValue(0);

      await clientService.findAll({ isActive: false });
      const call = (mockPrisma.client.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.isActive).toBe(false);
    });
  });

  describe('findById', () => {
    it('should return client by ID', async () => {
      const mock = factories.client();
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(mock);

      const result = await clientService.findById('client-uuid-1');
      expect(result.id).toBe(mock.id);
    });

    it('should throw NotFoundError for unknown ID', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(clientService.findById('nope')).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('should update a client', async () => {
      const mock = factories.client();
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(mock);
      (mockPrisma.client.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.client.update as jest.Mock).mockResolvedValue({ ...mock, firstName: 'Updated' });

      const result = await clientService.update('client-uuid-1', { firstName: 'Updated' });
      expect(result.firstName).toBe('Updated');
    });

    it('should throw ConflictError if phone already used by another client', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(factories.client());
      (mockPrisma.client.findFirst as jest.Mock).mockResolvedValue(
        factories.client({ id: 'other-id', phone: '+221779999999' })
      );

      await expect(
        clientService.update('client-uuid-1', { phone: '+221779999999' })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('delete', () => {
    it('should delete a client', async () => {
      const mock = factories.client();
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(mock);
      (mockPrisma.client.delete as jest.Mock).mockResolvedValue(mock);

      await clientService.delete('client-uuid-1');
      expect(mockPrisma.client.delete).toHaveBeenCalledWith({ where: { id: 'client-uuid-1' } });
    });
  });

  describe('bulkImport', () => {
    function makeExcelBuffer(rows: object[]): Buffer {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }

    it('should import valid rows successfully', async () => {
      const rows = [
        { firstName: 'Alice', lastName: 'Martin', phone: '+221771111111', email: 'alice@test.com' },
        { firstName: 'Bob',   lastName: 'Diallo', phone: '+221772222222' },
      ];
      const buffer = makeExcelBuffer(rows);
      (mockPrisma.client.upsert as jest.Mock).mockImplementation(async ({ create }) =>
        factories.client({ phone: create.phone, firstName: create.firstName })
      );

      const result = await clientService.bulkImport(buffer);
      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should report error for rows missing phone', async () => {
      const buffer = makeExcelBuffer([{ firstName: 'Alice', lastName: 'Martin' }]);
      const result = await clientService.bulkImport(buffer);

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain('Phone number is required');
    });

    it('should report error for rows missing firstName', async () => {
      const buffer = makeExcelBuffer([{ lastName: 'Martin', phone: '+221771111111' }]);
      const result = await clientService.bulkImport(buffer);

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain('First name is required');
    });
  });

  describe('exportToExcel', () => {
    it('should return a valid Excel buffer', async () => {
      (mockPrisma.client.findMany as jest.Mock).mockResolvedValue([
        { ...factories.client(), groups: [] },
      ]);

      const buffer = await clientService.exportToExcel();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);

      const wb = XLSX.read(buffer, { type: 'buffer' });
      expect(wb.SheetNames).toContain('Clients');

      const rows = XLSX.utils.sheet_to_json(wb.Sheets['Clients']);
      expect(rows.length).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return client stats', async () => {
      (mockPrisma.client.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(2);
      (mockPrisma.group.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await clientService.getStats();
      expect(stats.total).toBe(10);
      expect(stats.active).toBe(8);
      expect(stats.inactive).toBe(2);
    });
  });
});
