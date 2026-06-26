import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DealStageEnum {
  PROSPECTING = 'PROSPECTING',
  QUALIFICATION = 'QUALIFICATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
}

export class CreateDealDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: DealStageEnum })
  @IsOptional()
  @IsEnum(DealStageEnum)
  stage?: DealStageEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  probability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedCloseAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class UpdateDealDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: DealStageEnum })
  @IsOptional()
  @IsEnum(DealStageEnum)
  stage?: DealStageEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  probability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedCloseAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
