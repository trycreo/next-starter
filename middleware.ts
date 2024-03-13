import {type NextRequest, NextResponse} from "next/server";
import {jwtVerify} from "jose";

export async function middleware(request: NextRequest) {

    if (isTool(request)) {
        return AppMiddleware(request);
    }
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        // "/((?!_next/static|_next/image|favicon.ico).*)",
        "/((?!api/|_next/|_static/|_vercel|login|[\\w-]+\\.\\w+).*)",
    ],
};


export async function AppMiddleware(request: NextRequest) {
    const {fullKey} = parse(request);
    const match = fullKey.match(/tools\/(.*)/);
    const slug = match ? match[1] : "";
    const token = request.nextUrl.searchParams.get("token");
    if (!token) return authenticationFailedResponse(request);
    const secretKey = process.env.CREO_SHARED_SECRET_KEY;
    if (!secretKey) return authenticationFailedResponse(request);
    try {
        const decodedToken = await verify(token, secretKey);
        const {toolName} = decodedToken;
        if (slug !== toolName)
            return authenticationFailedResponse(request);
        if (!decodedToken)
            return authenticationFailedResponse(request);
        return NextResponse.next();
    } catch (err) {
        return authenticationFailedResponse(request);
    }
}

function isTool(request: NextRequest) {
    const {key} = parse(request);
    return process.env.NODE_ENV === "production" && key === "tools";
}

async function verify(token: string, secret: string) {
    const {payload} = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
    );
    return payload;
}

function authenticationFailedResponse(request: NextRequest) {
    return NextResponse.redirect(new URL("/error/unauthorized", request.url));
}

const parse = (req: NextRequest) => {
    let domain = req.headers.get("host") as string;
    let path = req.nextUrl.pathname;
    const searchParams = req.nextUrl.searchParams.toString();
    const fullPath = `${path}${
        searchParams.length > 0 ? `?${searchParams}` : ""
    }`;
    const key = decodeURIComponent(path.split("/")[1]!);
    const fullKey = decodeURIComponent(path.slice(1));
    return {domain, path, fullPath, key, fullKey};
};