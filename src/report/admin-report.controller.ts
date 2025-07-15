import {
    Controller,
    Get,
    Patch,
    Param,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { JwtRefreshAuthGuard } from '../auth/Middleware/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from '../admin/admin.service';

@Controller('admin/reports')
@UseGuards(JwtRefreshAuthGuard)
export class AdminReportController {
    constructor(
        private readonly reportService: ReportService,
        private readonly adminService: AdminService,
    ) { }

    @Get()
    async getAllReports(
        @CurrentUser('sub') adminId: string,
        @Query() query: ReportQueryDto,
    ) {
        await this.adminService.ensureAdmin(adminId);

        const result = await this.reportService.getAllReports(query);
        return {
            success: true,
            data: result,
        };
    }

    @Get('stats')
    async getReportStats(@CurrentUser('sub') adminId: string) {
        await this.adminService.ensureAdmin(adminId);

        const stats = await this.reportService.getReportStats();
        return {
            success: true,
            data: stats,
        };
    }

    @Get(':id')
    async getReportById(
        @CurrentUser('sub') adminId: string,
        @Param('id') reportId: string,
    ) {
        await this.adminService.ensureAdmin(adminId);

        const report = await this.reportService.getReportById(reportId);
        return {
            success: true,
            data: report,
        };
    }

    @Patch(':id/resolve')
    async resolveReport(
        @CurrentUser('sub') adminId: string,
        @Param('id') reportId: string,
        @Body() resolveReportDto: ResolveReportDto,
    ) {
        await this.adminService.ensureAdmin(adminId);

        const report = await this.reportService.resolveReport(
            reportId,
            adminId,
            resolveReportDto,
        );

        return {
            success: true,
            message: 'Báo cáo đã được xử lý',
            data: report,
        };
    }

    @Patch('bulk-resolve')
    async bulkResolveReports(
        @CurrentUser('sub') adminId: string,
        @Body() bulkResolveDto: any,
    ) {
        await this.adminService.ensureAdmin(adminId);

        const result = await this.reportService.bulkResolveReports(
            adminId,
            bulkResolveDto,
        );

        return {
            success: true,
            message: `Đã xử lý ${result.success} báo cáo thành công, ${result.failed} báo cáo thất bại`,
            data: result,
        };
    }

    @Get('analytics')
    async getReportAnalytics(@CurrentUser('sub') adminId: string) {
        await this.adminService.ensureAdmin(adminId);

        const analytics = await this.reportService.getReportAnalytics();
        return {
            success: true,
            data: analytics,
        };
    }
}