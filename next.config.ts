import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

if (basePath && !basePath.startsWith("/")) {
  throw new Error("NEXT_PUBLIC_BASE_PATH must start with a slash (e.g. /funding-ops)");
}

const nextConfig: NextConfig = {
  // If no basePath is provided, we default to /funding-ops to match the expected hub integration
  basePath: basePath || "/funding-ops",
  output: "standalone",
  typedRoutes: true,
};

export default nextConfig;
