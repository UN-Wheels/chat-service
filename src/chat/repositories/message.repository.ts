import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Message,
  MessageDocument,
  MessageStatus,
} from '../schemas/message.schema';
import {
  IMessageRepository,
  PaginatedMessages,
} from './message.repository.interface';

@Injectable()
export class MessageRepository implements IMessageRepository {
  private readonly logger = new Logger(MessageRepository.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  async create(
    conversationId: string,
    senderId: string,
    content: string,
  ): Promise<MessageDocument> {
    const message = await this.messageModel.create({
      conversationId: new Types.ObjectId(conversationId),
      senderId,
      content,
      status: MessageStatus.SENT,
      deliveredAt: null,
      readAt: null,
    });

    return message;
  }

  async findByConversation(
    conversationId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedMessages> {
    const convObjectId = new Types.ObjectId(conversationId);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.messageModel
        .find({ conversationId: convObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageModel.countDocuments({ conversationId: convObjectId }).exec(),
    ]);

    return {
      items: items.reverse(), // Devolver en orden cronológico (ASC)
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markAsDelivered(messageId: string): Promise<MessageDocument | null> {
    if (!Types.ObjectId.isValid(messageId)) return null;

    return this.messageModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(messageId),
          status: MessageStatus.SENT, // Solo actualizar si está en SENT
        },
        {
          status: MessageStatus.DELIVERED,
          deliveredAt: new Date(),
        },
        { new: true },
      )
      .exec();
  }

  async markAsRead(
    conversationId: string,
    readerUserId: string,
  ): Promise<number> {
    const convObjectId = new Types.ObjectId(conversationId);
    const now = new Date();

    const result = await this.messageModel
      .updateMany(
        {
          conversationId: convObjectId,
          senderId: { $ne: readerUserId }, // Solo mensajes del OTRO usuario
          status: { $ne: MessageStatus.READ }, // Que no estén ya leídos
        },
        {
          status: MessageStatus.READ,
          readAt: now,
          // Si no tenía deliveredAt, marcarlo también
          $setOnInsert: {},
        },
      )
      .exec();

    // Asegurar que deliveredAt se setee si no estaba
    await this.messageModel
      .updateMany(
        {
          conversationId: convObjectId,
          senderId: { $ne: readerUserId },
          status: MessageStatus.READ,
          deliveredAt: null,
        },
        {
          deliveredAt: now,
        },
      )
      .exec();

    return result.modifiedCount;
  }

  async countUnread(conversationId: string, userId: string): Promise<number> {
    const convObjectId = new Types.ObjectId(conversationId);

    return this.messageModel
      .countDocuments({
        conversationId: convObjectId,
        senderId: { $ne: userId },
        status: { $ne: MessageStatus.READ },
      })
      .exec();
  }

  async findLastMessage(
    conversationId: string,
  ): Promise<MessageDocument | null> {
    const convObjectId = new Types.ObjectId(conversationId);

    return this.messageModel
      .findOne({ conversationId: convObjectId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async markManyAsDelivered(
    conversationId: string,
    recipientUserId: string,
  ): Promise<number> {
    const convObjectId = new Types.ObjectId(conversationId);

    const result = await this.messageModel
      .updateMany(
        {
          conversationId: convObjectId,
          senderId: { $ne: recipientUserId }, // Mensajes del otro usuario
          status: MessageStatus.SENT, // Solo los que están en SENT
        },
        {
          status: MessageStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      )
      .exec();

    return result.modifiedCount;
  }
}
