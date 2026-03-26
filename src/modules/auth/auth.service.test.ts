import '../../tests/mocks';
import { AuthService } from './auth.service';
import { mockPrisma, factories } from '../../../tests/helpers';
import { ConflictError, UnauthorizedError } from '../../shared/utils/errors';
import bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user and return a JWT token', async () => {
      const dto = { name: 'Test User', email: 'test@example.com', password: 'password123' };
      const mockUser = factories.user({ email: dto.email, name: dto.name });

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.register(dto);

      expect(result.user.email).toBe(dto.email);
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictError if email already registered', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(factories.user());

      await expect(
        authService.register({ name: 'Test', email: 'existing@example.com', password: 'pass12345' })
      ).rejects.toThrow(ConflictError);
    });

    it('should hash the password before storing', async () => {
      const dto = { name: 'Test', email: 'new@example.com', password: 'plaintext123' };
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockImplementation(async ({ data }) => ({
        ...factories.user(),
        password: data.password,
      }));

      await authService.register(dto);

      const createCall = (mockPrisma.user.create as jest.Mock).mock.calls[0][0];
      const storedPassword = createCall.data.password;
      expect(storedPassword).not.toBe(dto.password);
      const isHashed = await bcrypt.compare(dto.password, storedPassword);
      expect(isHashed).toBe(true);
    });
  });

  describe('login', () => {
    it('should return token on valid credentials', async () => {
      const password = 'password123';
      const hashed = await bcrypt.hash(password, 10);
      const mockUser = factories.user({ password: hashed });

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.login({ email: mockUser.email, password });
      expect(result.token).toBeDefined();
      expect(result.user.id).toBe(mockUser.id);
    });

    it('should throw UnauthorizedError for unknown email', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nobody@example.com', password: 'pass' })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError for wrong password', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        factories.user({ password: hashed })
      );

      await expect(
        authService.login({ email: 'test@example.com', password: 'wrong-password' })
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        createdAt: new Date(),
      };
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const profile = await authService.getProfile('user-uuid-1');
      expect(profile.id).toBe(mockUser.id);
      expect((profile as Record<string, unknown>).password).toBeUndefined();
    });

    it('should throw UnauthorizedError if user not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(authService.getProfile('ghost-id')).rejects.toThrow(UnauthorizedError);
    });
  });
});
