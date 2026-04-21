import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkBookingDto {
  @ApiProperty({
    description: 'ID del booking a vincular con la conversación',
    example: 'booking_xyz789',
  })
  @IsString()
  @IsNotEmpty({ message: 'El bookingId es requerido' })
  bookingId: string;
}
