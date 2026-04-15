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

    // Si el request viene del API Gateway, X-User-Id ya fue validado upstream.
    // Confiar en el header directamente evita revalidar el JWT aquí.
    const gatewayUserId = request.headers?.['x-user-id'];
    if (gatewayUserId) {
      request.user = {
        userId: gatewayUserId,
        role: request.headers?.['x-user-role'] || '',
      };
      return true;
    }

    // Fallback: validación JWT directa (llamadas sin pasar por el gateway)
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
    // 1. Cookie access_token (nombre estándar definido por el API Gateway)
    const cookieToken = request.cookies?.access_token;
    if (cookieToken) return cookieToken;

    // 2. Header Authorization: Bearer ...
    const authHeader = request.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return undefined;
  }
}
