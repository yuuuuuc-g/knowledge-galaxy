import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get("authorization");
  const expectedPassword = process.env.SITE_PASSWORD;

  // 1. 如果没有头，直接拦截
  if (!basicAuth) {
    return new NextResponse("Auth required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
    });
  }

  try {
    // 2. 解析过程（修复了直接使用 split(':') 导致密码内含有冒号时被错误截断的隐患）
    const authValue = basicAuth.split(" ")[1];
    const decodedValue = atob(authValue);
    const separatorIndex = decodedValue.indexOf(":");

    if (separatorIndex === -1) {
      throw new Error("Invalid Basic Auth format");
    }

    const user = decodedValue.substring(0, separatorIndex);
    const pwd = decodedValue.substring(separatorIndex + 1);

    // 3. 核心比对与透视日志
    const isUserMatch = user === "admin";
    const isPwdMatch = pwd === expectedPassword;

    console.log("================ MIDDLEWARE DEBUG ================");
    console.log(
      `[预期密码] "${expectedPassword}" (类型: ${typeof expectedPassword}, 长度: ${expectedPassword?.length})`
    );
    console.log(`[收到账号] "${user}" (匹配: ${isUserMatch})`);
    console.log(`[收到密码] "${pwd}" (匹配: ${isPwdMatch}, 长度: ${pwd?.length})`);
    console.log("==================================================");

    if (isUserMatch && isPwdMatch) {
      return NextResponse.next();
    }

    // 4. 校验失败，返回 401，并在 HTTP Header 中带上不敏感的线索
    return new NextResponse("Auth failed. Please check Vercel Logs.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Secure Area"',
        "X-Debug-Expected-Length": `${expectedPassword?.length}`,
        "X-Debug-Provided-Length": `${pwd?.length}`,
      },
    });
  } catch (error) {
    console.error("[Middleware Debug] 解析异常:", error);
    return new NextResponse("Bad Request", { status: 400 });
  }
}

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico|textures).*)"],
};
