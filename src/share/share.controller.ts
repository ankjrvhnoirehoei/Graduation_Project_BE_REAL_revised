import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class ShareController {
  @Get('share/:id')
  fallback(@Param('id') id: string, @Res() res: Response) {
    const schemeUri = `cirla://share/${id}`;
    const webUrl    = `https://cirla.io.vn/share/${id}`;

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

          // 1) Ngay khi load, cố mở app
          window.location = schemeUri;

          // 2) Nếu browser vẫn ở lại sau 1.5s, hiện nút
          setTimeout(() => {
            fallbackButton.style.display = 'inline-block';
          }, 1500);

          // 3) Khi user bấm nút, thử mở lại
          fallbackButton.addEventListener('click', () => {
            window.location = schemeUri;
          });
        </script>
      </body>
      </html>
    `);
  }
}