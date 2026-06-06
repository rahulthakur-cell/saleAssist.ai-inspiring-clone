import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'you@company.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password1' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ required: false, example: 'acme-inc' })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}
