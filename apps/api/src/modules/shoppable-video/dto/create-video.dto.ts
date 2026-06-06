import { IsString, IsOptional, IsBoolean, IsEnum, IsNumber, IsUrl, Min, Max, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVideoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  videoUrl!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @ApiProperty({ enum: ['carousel', 'hero', 'story', 'grid'], default: 'carousel' })
  @IsEnum(['carousel', 'hero', 'story', 'grid'])
  @IsOptional()
  displayType?: string = 'carousel';

  @ApiProperty({ default: false })
  @IsBoolean()
  @IsOptional()
  autoplay?: boolean = false;

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  loop?: boolean = true;

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  muted?: boolean = true;
}

export class UpdateVideoDto {
  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  status?: string; // e.g. DRAFT, PUBLISHED, ARCHIVED

  @ApiProperty({ required: false })
  @IsEnum(['carousel', 'hero', 'story', 'grid'])
  @IsOptional()
  displayType?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  autoplay?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  loop?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  muted?: boolean;
}

export class CreateHotspotDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  productName!: string;

  @ApiProperty()
  @IsUrl()
  productUrl!: string;

  @ApiProperty({ required: false })
  @IsUrl()
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

  @ApiProperty()
  @IsNumber()
  @Min(0)
  startTime!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  endTime!: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  posX?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  posY?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  width?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  height?: number;
}
