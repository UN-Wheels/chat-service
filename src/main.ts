import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3001);
  const corsOrigin = configService.get<string>('cors.origin', 'http://localhost:5173');

  // CORS — en dev permitimos cualquier origen para pruebas locales
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Cookie parser (para leer accessToken de cookies)
  app.use(cookieParser());

  // Validación global con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('UniWheels Chat Service')
    .setDescription(
      'Microservicio de chat en tiempo real para UniWheels. ' +
        'Gestiona conversaciones y mensajes entre conductores y pasajeros.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('accessToken')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, document, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'UniWheels Chat API',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  // Health endpoint
  app.getHttpAdapter().get('/health', async (_req: any, res: any) => {
    try {
      // Mongoose publica el estado de conexión
      const mongoose = await import('mongoose');
      const dbState = mongoose.connection.readyState;
      const dbStatus =
        dbState === 1
          ? 'connected'
          : dbState === 2
            ? 'connecting'
            : 'disconnected';

      res.status(dbState === 1 ? 200 : 503).json({
        status: dbState === 1 ? 'ok' : 'error',
        message:
          dbState === 1
            ? 'El servidor esta funcionando correctamente'
            : 'El servidor tiene problemas de conexion a la base de datos',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        uptime: process.uptime(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: 'Error al verificar estado del servidor',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      });
    }
  });

  await app.listen(port);
  logger.log(`Servidor escuchando en http://localhost:${port}`);
  logger.log(`Swagger disponible en http://localhost:${port}/swagger`);
}

bootstrap();
