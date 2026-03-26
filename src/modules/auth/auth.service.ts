import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../shared/config/prisma';
import { config } from '../../shared/config';
import { ConflictError, UnauthorizedError } from '../../shared/utils/errors';
import { RegisterDto, LoginDto, AuthResponse } from './auth.types';

export class AuthService {
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
      },
    });

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!user) throw new UnauthorizedError('User not found');
    return user;
  }

  private generateToken(userId: string, email: string, role: string): string {
    return jwt.sign({ userId, email, role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }
}
