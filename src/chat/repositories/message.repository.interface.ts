import { MessageDocument, MessageStatus } from '../schemas/message.schema';
import { Types } from 'mongoose';

export interface PaginatedMessages {
  items: MessageDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Interfaz abstracta para el repositorio de mensajes.
 */
export interface IMessageRepository {
  /**
   * Crea un nuevo mensaje con estado SENT.
   */
  create(
    conversationId: string,
    senderId: string,
    content: string,
  ): Promise<MessageDocument>;

  /**
   * Obtiene mensajes de una conversación con paginación.
   * Ordenados por createdAt descendente (más recientes primero).
   */
  findByConversation(
    conversationId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedMessages>;

  /**
   * Marca un mensaje individual como DELIVERED y registra deliveredAt.
   */
  markAsDelivered(messageId: string): Promise<MessageDocument | null>;

  /**
   * Marca todos los mensajes no leídos de una conversación como READ
   * (solo los enviados por el otro usuario, no por el lector).
   */
  markAsRead(
    conversationId: string,
    readerUserId: string,
  ): Promise<number>;

  /**
   * Cuenta los mensajes no leídos en una conversación para un usuario.
   * (mensajes enviados por el OTRO usuario que no están en estado READ).
   */
  countUnread(conversationId: string, userId: string): Promise<number>;

  /**
   * Obtiene el último mensaje de una conversación.
   */
  findLastMessage(conversationId: string): Promise<MessageDocument | null>;

  /**
   * Marca múltiples mensajes como DELIVERED en bulk
   * (cuando el cliente se reconecta y confirma recepción).
   */
  markManyAsDelivered(
    conversationId: string,
    recipientUserId: string,
  ): Promise<number>;
}

/** Token de inyección para DI de NestJS */
export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');
