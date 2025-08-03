import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtRefreshAuthGuard } from 'src/auth/Middleware/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller()
export class ShareController {
  @Get('share/:id')
  share(@Param('id') id: string, @Res() res: Response) {
    this.renderFallback(res, `share/${id}`);
  }

  @Get('profile/:id')
  profile(@Param('id') id: string, @Res() res: Response) {
    this.renderFallback(res, `profile/${id}`);
  }

  @Get('join-room/:roomId')
  @UseGuards(JwtRefreshAuthGuard)
  async joinRoom(
    @Param('roomId') roomId: string,
    @CurrentUser('sub') userId: string,
    @Res() res: Response,
  ) {
    const path = `join-room/${roomId}?userId=${userId}`;
    this.renderFallback(res, path);
  }

  private renderFallback(res: Response, path: string) {
    const schemeUri = `cirla://home?path=${encodeURIComponent(path)}`;
    const webUrl = `https://cirla.io.vn/${path}`;

    res.send(`
      <!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Cirla App</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 2em }
        #openApp {
          display: none;
          padding: .75em 1.5em;
          font-size: 1rem;
          margin-top: 1em;
          cursor: pointer;
          background-color: #3f51b5;
          color: white;
          border: none;
          border-radius: 6px;
        }
      </style>
      </head><body>
        <h1>Đang mở ứng dụng Cirla…</h1>
        <p>Nếu không thấy gì xảy ra, nhấn nút bên dưới:</p>
        <button id="openApp">Mở ứng dụng Cirla</button>
        <p>Hoặc tiếp tục trên <a href="${webUrl}">trang web</a>.</p>
        <script>
          const schemeUri = '${schemeUri}';
          const btn = document.getElementById('openApp');
          window.location = schemeUri;

          setTimeout(() => {
            btn.style.display = 'inline-block';
          }, 1500);

          btn.addEventListener('click', () => {
            window.location = schemeUri;
          });
        </script>
      </body></html>
    `);
  }
}
