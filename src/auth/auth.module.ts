import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { WsJwtGuard } from './ws-jwt.guard';

@Module({
  imports: [ConfigModule],
  providers: [JwtAuthGuard, WsJwtGuard],
  exports: [JwtAuthGuard, WsJwtGuard],
})
export class AuthModule {}
