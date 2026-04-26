import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

// Schemas
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';

// Repositories
import { CONVERSATION_REPOSITORY } from './repositories/conversation.repository.interface';
import { ConversationRepository } from './repositories/conversation.repository';
import { MESSAGE_REPOSITORY } from './repositories/message.repository.interface';
import { MessageRepository } from './repositories/message.repository';

// Service, Controller, Gateway
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';

// Auth
import { AuthModule } from '../auth/auth.module';

// Route Validation
import { RouteValidationModule } from '../route-validation/route-validation.module';

// RabbitMQ
import { RabbitMQService } from '../config/rabbitmq';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    RouteValidationModule,
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  providers: [
    {
      provide: CONVERSATION_REPOSITORY,
      useClass: ConversationRepository,
    },
    {
      provide: MESSAGE_REPOSITORY,
      useClass: MessageRepository,
    },
    ChatService,
    ChatGateway,
    RabbitMQService,
  ],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
