import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    // Configuración global (.env + tipada)
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Conexión a MongoDB via Mongoose
    DatabaseModule,

    // Autenticación JWT
    AuthModule,

    // Chat (conversaciones, mensajes, Socket.IO gateway)
    ChatModule,
  ],
})
export class AppModule {}
