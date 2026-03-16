import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
  ConversationStatus,
} from '../schemas/conversation.schema';
import {
  ConversationSummary,
  FindOrCreateResult,
  IConversationRepository,
} from './conversation.repository.interface';
import { MessageStatus } from '../schemas/message.schema';

@Injectable()
export class ConversationRepository implements IConversationRepository {
  private readonly logger = new Logger(ConversationRepository.name);

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
  ) {}

  async findOrCreate(
    routeId: string,
    driverId: string,
    passengerId: string,
  ): Promise<FindOrCreateResult> {
    try {
      // Intento atómico con upsert — evita race conditions
      const existing = await this.conversationModel
        .findOne({ routeId, passengerId })
        .exec();

      if (existing) {
        return { conversation: existing, created: false };
      }

      const created = await this.conversationModel.create({
        routeId,
        driverId,
        passengerId,
        bookingId: null,
        status: ConversationStatus.ACTIVE,
      });

      return { conversation: created, created: true };
    } catch (error: any) {
      // Manejar race condition por índice único duplicado
      if (error.code === 11000) {
        this.logger.debug('Conversacion duplicada detectada, retornando existente');
        const existing = await this.conversationModel
          .findOne({ routeId, passengerId })
          .exec();
        if (existing) {
          return { conversation: existing, created: false };
        }
      }
      this.logger.error('Error al crear/obtener conversacion', error);
      throw error;
    }
  }

  async findByIdForUser(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDocument | null> {
    if (!Types.ObjectId.isValid(conversationId)) return null;

    return this.conversationModel
      .findOne({
        _id: new Types.ObjectId(conversationId),
        $or: [{ driverId: userId }, { passengerId: userId }],
      })
      .exec();
  }

  async findByUser(
    userId: string,
    status?: ConversationStatus,
  ): Promise<ConversationSummary[]> {
    const matchFilter: any = {
      $or: [{ driverId: userId }, { passengerId: userId }],
    };
    if (status) {
      matchFilter.status = status;
    }

    const results = await this.conversationModel.aggregate([
      { $match: matchFilter },
      // Unir con último mensaje
      {
        $lookup: {
          from: 'messages',
          let: { convId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$conversationId', '$$convId'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: 'lastMessage',
        },
      },
      { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
      // Contar no leídos (mensajes del OTRO usuario que no son READ)
      {
        $lookup: {
          from: 'messages',
          let: { convId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$convId'] },
                    { $ne: ['$senderId', userId] },
                    { $ne: ['$status', MessageStatus.READ] },
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'unreadInfo',
        },
      },
      { $unwind: { path: '$unreadInfo', preserveNullAndEmptyArrays: true } },
      // Ordenar por último mensaje (más reciente primero)
      {
        $sort: {
          'lastMessage.createdAt': -1,
          updatedAt: -1,
        },
      },
      // Proyectar resultado final
      {
        $project: {
          conversationId: { $toString: '$_id' },
          routeId: 1,
          otherUserId: {
            $cond: {
              if: { $eq: ['$driverId', userId] },
              then: '$passengerId',
              else: '$driverId',
            },
          },
          otherUserRole: {
            $cond: {
              if: { $eq: ['$driverId', userId] },
              then: 'passenger',
              else: 'driver',
            },
          },
          bookingId: 1,
          status: 1,
          lastMessageText: { $ifNull: ['$lastMessage.content', null] },
          lastMessageAt: { $ifNull: ['$lastMessage.createdAt', null] },
          unreadCount: { $ifNull: ['$unreadInfo.count', 0] },
          updatedAt: 1,
        },
      },
    ]);

    return results as ConversationSummary[];
  }

  async findByRoute(routeId: string): Promise<ConversationDocument[]> {
    return this.conversationModel.find({ routeId }).exec();
  }

  async findByRouteAndPassenger(
    routeId: string,
    passengerId: string,
  ): Promise<ConversationDocument | null> {
    return this.conversationModel.findOne({ routeId, passengerId }).exec();
  }

  async updateBookingId(
    conversationId: string,
    bookingId: string,
  ): Promise<ConversationDocument | null> {
    if (!Types.ObjectId.isValid(conversationId)) return null;

    return this.conversationModel
      .findByIdAndUpdate(
        conversationId,
        { bookingId },
        { new: true },
      )
      .exec();
  }

  async updateStatus(
    conversationId: string,
    status: ConversationStatus,
  ): Promise<ConversationDocument | null> {
    if (!Types.ObjectId.isValid(conversationId)) return null;

    return this.conversationModel
      .findByIdAndUpdate(
        conversationId,
        { status },
        { new: true },
      )
      .exec();
  }

  async touch(conversationId: string): Promise<void> {
    if (!Types.ObjectId.isValid(conversationId)) return;

    await this.conversationModel
      .findByIdAndUpdate(conversationId, { updatedAt: new Date() })
      .exec();
  }
}
