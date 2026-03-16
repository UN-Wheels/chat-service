import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import {
  IConversationRepository,
  CONVERSATION_REPOSITORY,
} from '../../chat/repositories/conversation.repository.interface';

/**
 * Guard que verifica que el usuario autenticado es participante
 * (driverId o passengerId) de la conversación solicitada.
 *
 * Funciona tanto para REST (param `conversationId`) como para WS (payload).
 */
@Injectable()
export class ParticipantGuard implements CanActivate {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepo: IConversationRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const contextType = context.getType();

    if (contextType === 'http') {
      return this.handleHttp(context);
    }

    if (contextType === 'ws') {
      return this.handleWs(context);
    }

    return false;
  }

  private async handleHttp(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const conversationId = request.params?.conversationId;

    if (!userId || !conversationId) {
      throw new ForbiddenException('Datos insuficientes para verificar participacion');
    }

    const conversation = await this.conversationRepo.findByIdForUser(
      conversationId,
      userId,
    );

    if (!conversation) {
      throw new NotFoundException('Conversacion no encontrada');
    }

    // Adjuntar la conversación al request para evitar queries duplicados
    request.conversation = conversation;
    return true;
  }

  private async handleWs(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const data = context.switchToWs().getData();
    const userId = client.data?.user?.userId;
    const conversationId = data?.conversationId;

    if (!userId || !conversationId) {
      throw new WsException('Datos insuficientes para verificar participacion');
    }

    const conversation = await this.conversationRepo.findByIdForUser(
      conversationId,
      userId,
    );

    if (!conversation) {
      throw new WsException('Conversacion no encontrada');
    }

    // Adjuntar la conversación al socket data para este evento
    client.data.conversation = conversation;
    return true;
  }
}
