import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { JwtRefreshAuthGuard } from '../auth/Middleware/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('reports')
@UseGuards(JwtRefreshAuthGuard)
export class ReportController {
    constructor(private readonly reportService: ReportService) { }

    @Post()
    async createReport(
        @CurrentUser('sub') userId: string,
        @Body() createReportDto: CreateReportDto,
    ) {
        const report = await this.reportService.createReport(userId, createReportDto);
        return {
            success: true,
            message: 'Báo cáo đã được gửi thành công',
            data: report,
        };
    }

    @Get('my')
    async getMyReports(
        @CurrentUser('sub') userId: string,
        @Query() query: ReportQueryDto,
    ) {
        const result = await this.reportService.getMyReports(userId, query);
        return {
            success: true,
            data: result,
        };
    }

    @Delete(':id')
    async deleteReport(
        @CurrentUser('sub') userId: string,
        @Param('id') reportId: string,
    ) {
        await this.reportService.deleteReport(reportId, userId);
        return {
            success: true,
            message: 'Báo cáo đã được xóa',
        };
    }
}