import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class ShareController {
  @Get('share/:id')
  share(@Param('id') id: string, @Res() res: Response) {
    this.renderFallback(res, `share/${id}`, `share/${id}`);
  }

  @Get('*')
  fallback(@Res() res: Response) {
    this.renderFallback(res, '', '');
  }

  private renderFallback(res: Response, schemePath: string, webPath: string) {
    const schemeUri = `cirla://${schemePath}`;
    const webUrl = webPath
      ? `https://cirla.io.vn/${webPath}`
      : 'https://cirla.io.vn/';

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Open in App</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 2em; }
          #openApp {
            display: none;
            padding: 0.75em 1.5em;
            font-size: 1rem;
            margin-top: 1em;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <h1>Opening the App…</h1>
        <p>If nothing happens, tap the button below:</p>
        <button id="openApp">Open in App</button>
        <p>Or continue on <a href="${webUrl}">this page</a>.</p>

        <script>
          const schemeUri = '${schemeUri}';
          const fallbackButton = document.getElementById('openApp');

          // 1) Thử mở app ngay khi load
          window.location = schemeUri;

          // 2) Nếu vẫn ở lại trang web sau 1.5s, show nút
          setTimeout(() => {
            fallbackButton.style.display = 'inline-block';
          }, 1500);

          // 3) Khi user bấm nút, thử mở app lại
          fallbackButton.addEventListener('click', () => {
            window.location = schemeUri;
          });
        </script>
      </body>
      </html>
    `);
  }
}
