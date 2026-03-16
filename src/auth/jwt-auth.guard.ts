import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from './interfaces';

/**
 * Guard REST que valida JWT desde cookie `accessToken` o header `Authorization: Bearer ...`.
 * Compatible con el esquema de auth del servicio principal (finditunal-backend).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    try {
      const secret = this.configService.get<string>('jwt.accessSecret');
      const decoded = jwt.verify(token, secret!) as JwtPayload;

      if (!decoded.user_id) {
        throw new UnauthorizedException('Token sin user_id');
      }

      // Adjuntar usuario al request (accesible via @Req() en controllers)
      request.user = {
        userId: decoded.user_id,
        role: decoded.role,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Token invalido');
    }
  }

  private extractToken(request: any): string | undefined {
    // 1. Cookie accessToken
    const cookieToken = request.cookies?.accessToken;
    if (cookieToken) return cookieToken;

    // 2. Header Authorization: Bearer ...
    const authHeader = request.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return undefined;
  }
}
