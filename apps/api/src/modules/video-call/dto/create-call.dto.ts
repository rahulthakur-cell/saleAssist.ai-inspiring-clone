import { IsEnum, IsOptional, IsString, IsEmail, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VideoCallType } from '@saleassist/database';

export class SendChatMessageDto {
  @ApiProperty()
  @IsString()
  message!: string;

  @ApiProperty()
  @IsString()
  senderName!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  senderId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  attachmentUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  attachmentType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  attachmentName?: string;
}

export class GetChatUploadUrlDto {
  @ApiProperty()
  @IsString()
  fileName!: string;

  @ApiProperty()
  @IsString()
  fileType!: string;
}

export class CreateCallDto {
  @ApiProperty({ enum: VideoCallType, default: VideoCallType.INBOUND })
  @IsEnum(VideoCallType)
  @IsOptional()
  type?: VideoCallType = VideoCallType.INBOUND;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  visitorName?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  visitorEmail?: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  visitorPhone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  routingMethod?: string;
}

export class JoinCallDto {
  @ApiProperty()
  @IsString()
  participantName!: string;
}
