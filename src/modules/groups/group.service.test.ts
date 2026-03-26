import '../../tests/mocks';
import { GroupService } from './group.service';
import { ConflictError, NotFoundError } from '../../shared/utils/errors';
import { factories } from '../../../tests/helpers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma: mockPrisma } = require('src/shared/config/prisma');

describe('GroupService', () => {
  let groupService: GroupService;

  beforeEach(() => {
    groupService = new GroupService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new group', async () => {
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.group.create as jest.Mock).mockResolvedValue(factories.group());

      const result = await groupService.create({ name: 'VIP Clients', color: '#3B82F6' });
      expect(result.name).toBe('VIP Clients');
    });

    it('should throw ConflictError if name already exists', async () => {
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(factories.group());
      await expect(groupService.create({ name: 'VIP Clients' })).rejects.toThrow(ConflictError);
    });
  });

  describe('findAll', () => {
    it('should return paginated groups', async () => {
      const groups = [factories.group(), factories.group({ id: 'g2', name: 'Newsletter' })];
      (mockPrisma.group.findMany as jest.Mock).mockResolvedValue(groups);
      (mockPrisma.group.count as jest.Mock).mockResolvedValue(2);

      const result = await groupService.findAll(1, 10);
      expect(result.groups).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });

  describe('findById', () => {
    it('should return a group', async () => {
      const mock = { ...factories.group(), clients: [] };
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mock);
      const result = await groupService.findById('group-uuid-1');
      expect(result.id).toBe(mock.id);
    });

    it('should throw NotFoundError for unknown ID', async () => {
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(groupService.findById('nope')).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('should update group name', async () => {
      const mock = { ...factories.group(), clients: [] };
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mock);
      (mockPrisma.group.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.group.update as jest.Mock).mockResolvedValue({ ...mock, name: 'Updated Name' });

      const result = await groupService.update('group-uuid-1', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw ConflictError if new name taken by another group', async () => {
      const mock = { ...factories.group(), clients: [] };
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mock);
      (mockPrisma.group.findFirst as jest.Mock).mockResolvedValue(
        factories.group({ id: 'other-id', name: 'Taken' })
      );

      await expect(
        groupService.update('group-uuid-1', { name: 'Taken' })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('delete', () => {
    it('should delete a group', async () => {
      const mock = { ...factories.group(), clients: [] };
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mock);
      (mockPrisma.group.delete as jest.Mock).mockResolvedValue(mock);

      await groupService.delete('group-uuid-1');
      expect(mockPrisma.group.delete).toHaveBeenCalledWith({ where: { id: 'group-uuid-1' } });
    });
  });

  describe('getGroupClients', () => {
    it('should return clients in a group', async () => {
      const mock = { ...factories.group(), clients: [] };
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue(mock);
      (mockPrisma.clientGroup.findMany as jest.Mock).mockResolvedValue([
        { client: factories.client() },
      ]);
      (mockPrisma.clientGroup.count as jest.Mock).mockResolvedValue(1);

      const result = await groupService.getGroupClients('group-uuid-1');
      expect(result.clients).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
