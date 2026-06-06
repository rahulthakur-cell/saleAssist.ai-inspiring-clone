import { IsString, IsOptional, IsBoolean, IsDateString, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStreamDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  @IsOptional()
  isShoppable?: boolean = false;

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  allowChat?: boolean = true;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxViewers?: number;
}

export class AddProductDto {
  @ApiProperty()
  @IsString()
  productName!: string;

  @ApiProperty()
  @IsString()
  productUrl!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  productImage?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiProperty({ default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string = 'USD';
}

export class ChatMessageDto {
  @ApiProperty()
  @IsString()
  message!: string;

  @ApiProperty()
  @IsString()
  senderName!: string;
}
