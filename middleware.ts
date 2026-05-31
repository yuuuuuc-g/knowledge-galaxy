import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');

  if (basicAuth) {
    // 浏览器发来的是 "Basic base64字符串"，需要截取并解码
    const authValue = basicAuth.split(' ')[1];
    // 解码 Base64
    const decodedValue = atob(authValue);
    // 拆分出账号和密码
    const [user, pwd] = decodedValue.split(':');

    // 校验账号密码（账号固定为 admin，密码读取环境变量）
    if (user === 'admin' && pwd === process.env.SITE_PASSWORD) {
      return NextResponse.next();
    }
  }

  // 如果没有授权头，或者密码错误，强制要求认证
  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了以下绝对需要豁免的：
     * - api/cron (机器 CronJob，它有自己的 CRON_SECRET)
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (图标)
     * - textures/ (你的 3D 贴图等公共资产，按需添加)
     */
    '/((?!api/cron|_next/static|_next/image|favicon.ico|textures).*)',
  ],
};