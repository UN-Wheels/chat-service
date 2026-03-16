import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    description: 'Contenido del mensaje',
    example: 'Hola, ¿a qué hora sales?',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'El mensaje no puede estar vacio' })
  @MinLength(1, { message: 'El mensaje no puede estar vacio' })
  @MaxLength(2000, { message: 'El mensaje es demasiado largo (maximo 2000 caracteres)' })
  content: string;
}
