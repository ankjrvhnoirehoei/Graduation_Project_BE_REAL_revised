import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { ReportContentService } from './report-content.service';
import { CreateReportUserDto } from '../report-user/dto/create-report.dto';

@UseGuards(JwtRefreshAuthGuard)
@Controller('report-contents')
export class ReportContentController {
  constructor(private readonly reportContentService: ReportContentService) {}

  @Post('report')
  async reportContent(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateReportUserDto,
  ) {
    return this.reportContentService.createReport(dto, userId);
  }

  @Post('revoke/:id')
  async revokeReport(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const report = await this.reportContentService.findById(id);
    if (report.reporterId.toString() !== userId) {
      throw new ForbiddenException('Không được phép thu hồi báo cáo này.');
    }
    await this.reportContentService.revokeReport(id);
    return { message: 'Báo cáo thu hồi thành công' };
  }
}