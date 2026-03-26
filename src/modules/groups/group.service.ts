import { prisma } from '../../shared/config/prisma';
import { NotFoundError, ConflictError } from '../../shared/utils/errors';
import { buildPaginationMeta } from '../../shared/utils/response';
import { CreateGroupDto, UpdateGroupDto } from './group.types';

export class GroupService {
  async create(dto: CreateGroupDto) {
    const existing = await prisma.group.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictError(`Group "${dto.name}" already exists`);

    return prisma.group.create({
      data: dto,
      include: { _count: { select: { clients: true } } },
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { clients: true } } },
      }),
      prisma.group.count(),
    ]);

    return { groups, meta: buildPaginationMeta(total, page, limit) };
  }

  async findById(id: string) {
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        _count: { select: { clients: true } },
        clients: {
          take: 10,
          include: {
            client: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
      },
    });
    if (!group) throw new NotFoundError('Group');
    return group;
  }

  async update(id: string, dto: UpdateGroupDto) {
    await this.findById(id);

    if (dto.name) {
      const existing = await prisma.group.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (existing) throw new ConflictError(`Group name "${dto.name}" already taken`);
    }

    return prisma.group.update({
      where: { id },
      data: dto,
      include: { _count: { select: { clients: true } } },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.group.delete({ where: { id } });
  }

  async getGroupClients(groupId: string, page = 1, limit = 20) {
    await this.findById(groupId);
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.clientGroup.findMany({
        where: { groupId },
        skip,
        take: limit,
        include: {
          client: true,
        },
        orderBy: { assignedAt: 'desc' },
      }),
      prisma.clientGroup.count({ where: { groupId } }),
    ]);

    return {
      clients: records.map((r) => r.client),
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
