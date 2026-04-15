import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import * as jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { JwtPayload } from './interfaces';

/**
 * Guard para conexiones WebSocket (Socket.IO).
 * Valida JWT en el handshake desde:
 *   1. socket.handshake.auth.token
 *   2. Header Authorization: Bearer ...
 *   3. Cookie accessToken
 *
 * Almacena el payload decodificado en socket.data.user.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractTokenFromSocket(client);

    if (!token) {
      throw new WsException('Token no proporcionado');
    }

    try {
      const secret = this.configService.get<string>('jwt.accessSecret');
      const decoded = jwt.verify(token, secret!) as JwtPayload;

      if (!decoded.user_id) {
        throw new WsException('Token sin user_id');
      }

      client.data.user = {
        userId: decoded.user_id,
        role: decoded.role,
      };

      return true;
    } catch (error) {
      if (error instanceof WsException) throw error;
      this.logger.warn(`Token WS invalido: ${(error as Error).message}`);
      throw new WsException('Token invalido');
    }
  }

  private extractTokenFromSocket(client: Socket): string | undefined {
    // 1. Desde auth del handshake
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token;

    // 2. Header Authorization
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 3. Cookie access_token (nombre estándar definido por el API Gateway)
    const cookieHeader = client.handshake.headers?.cookie;
    if (cookieHeader) {
      const match = cookieHeader
        .split(';')
        .find((c) => c.trim().startsWith('access_token='));
      if (match) {
        return match.split('=')[1]?.trim();
      }
    }

    return undefined;
  }
}
