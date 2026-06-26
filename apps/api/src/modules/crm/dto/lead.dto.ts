import { IsString, IsOptional, IsEnum, IsNumber, IsEmail, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum LeadStatusEnum {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  UNQUALIFIED = 'UNQUALIFIED',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
}

export enum LeadSourceEnum {
  VIDEO_CALL = 'VIDEO_CALL',
  LIVE_STREAM = 'LIVE_STREAM',
  AI_CHAT = 'AI_CHAT',
  SHOPPABLE_VIDEO = 'SHOPPABLE_VIDEO',
  WIDGET = 'WIDGET',
  MANUAL = 'MANUAL',
  IMPORT = 'IMPORT',
}

export class CreateLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ enum: LeadSourceEnum })
  @IsOptional()
  @IsEnum(LeadSourceEnum)
  source?: LeadSourceEnum;

  @ApiPropertyOptional({ enum: LeadStatusEnum })
  @IsOptional()
  @IsEnum(LeadStatusEnum)
  status?: LeadStatusEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}

export class UpdateLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ enum: LeadSourceEnum })
  @IsOptional()
  @IsEnum(LeadSourceEnum)
  source?: LeadSourceEnum;

  @ApiPropertyOptional({ enum: LeadStatusEnum })
  @IsOptional()
  @IsEnum(LeadStatusEnum)
  status?: LeadStatusEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}
