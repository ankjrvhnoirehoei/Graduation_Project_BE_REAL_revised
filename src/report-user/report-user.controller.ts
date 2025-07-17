import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Patch,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { ReportUserService } from './report-user.service';
import { CreateReportUserDto } from './dto/create-report-user.dto';

@UseGuards(JwtRefreshAuthGuard)
@Controller('report-users')
export class ReportUserController {
  constructor(private readonly reportUserService: ReportUserService) {}

  @Post('report')
  async reportUser(
    @CurrentUser('sub') userId: string,
    @Body() createReportDto: CreateReportUserDto,
  ) {
    return this.reportUserService.create(userId, createReportDto);
  }

  @Get(':id')
  async getReport(@Param('id') id: string) {
    return this.reportUserService.findById(id);
  }

  @Post('revoke/:id')
  async revokeReport(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const report = await this.reportUserService.findById(id);
    if (report.reporterId.toString() !== userId) {
      throw new ForbiddenException('Không được phép thu hồi báo cáo này.');
    }
    await this.reportUserService.revokeReport(id);
    return { message: 'Báo cáo thu hồi thành công' };
  }
}