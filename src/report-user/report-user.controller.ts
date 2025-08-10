import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Patch,
  UseGuards,
  ForbiddenException,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { ReportUserService } from './report-user.service';
import { CreateReportUserDto } from './dto/create-report.dto';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { UserService } from 'src/user/user.service';

@UseGuards(JwtRefreshAuthGuard)
@Controller('report-users')
export class ReportUserController {
  constructor(
    private readonly reportUserService: ReportUserService,
    private readonly users: UserService,
  ) {}

  private async assertAdmin(userId: string) {
    const me = await this.users.getUserById(userId);
    if (me?.role !== 'admin') throw new UnauthorizedException('Only admin');
  }

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

  @Get()
  async list(
    @CurrentUser('sub') adminId: string,
    @Query('search') search?: string,
    @Query('reason') reason?: string,
    @Query('status') status?: 'open' | 'resolved' | 'dismissed',
    @Query('isRead') isRead?: 'read' | 'unread',
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('sort') sort: 'asc' | 'desc' = 'desc',
  ) {
    await this.assertAdmin(adminId);
    return this.reportUserService.listAdmin({
      search,
      reason,
      status: (status as any) || '',
      isRead: (isRead as any) || '',
      start,
      end,
      page: Number(page),
      limit: Number(limit),
      sort,
    });
  }
}
