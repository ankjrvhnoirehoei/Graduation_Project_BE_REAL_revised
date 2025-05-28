import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reaction, ReactionSchema } from './reaction.schema';
import { ReactionService } from './reaction.service';
import { ReactionController } from './reaction.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '@app/common';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
        { name: Reaction.name, schema: ReactionSchema }
    ]),
    JwtModule.registerAsync({
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
            secret: configService.get('JWT_ACCESS_SECRET'),
            signOptions: { expiresIn: '15m' },
        }),
    }),
  ],
  providers: [ReactionService],
  controllers: [ReactionController],
  exports: [ReactionService],
})
export class ReactionModule {}