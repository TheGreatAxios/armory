/**
 * Route Utilities Tests
 * Tests the route pattern matching and configuration validation
 */
import { describe, expect, test } from "bun:test";
import {
  findMatchingRoute,
  matchRoute,
  parseRoutePattern,
  type RouteConfig,
  validateRouteConfig,
} from "../src/utils/routes";

describe("[unit|base]: Route Pattern Parsing", () => {
  test("[parseRoutePattern|exact] - parses exact route pattern", () => {
    const result = parseRoutePattern("/api/users");
    expect(result.segments).toEqual(["api", "users"]);
    expect(result.isWildcard).toBe(false);
    expect(result.isParametrized).toBe(false);
    expect(result.priority).toBe(3);
  });

  test("[parseRoutePattern|wildcard] - parses wildcard route pattern", () => {
    const result = parseRoutePattern("/api/*");
    expect(result.segments).toEqual(["api", "*"]);
    expect(result.isWildcard).toBe(true);
    expect(result.isParametrized).toBe(false);
    expect(result.priority).toBe(1);
  });

  test("[parseRoutePattern|parameterized] - parses parameterized route pattern", () => {
    const result = parseRoutePattern("/api/users/:id");
    expect(result.segments).toEqual(["api", "users", ":id"]);
    expect(result.isWildcard).toBe(false);
    expect(result.isParametrized).toBe(true);
    expect(result.paramNames).toEqual(["id"]);
    expect(result.priority).toBe(2);
  });

  test("[parseRoutePattern|nextjs] - parses Next.js style wildcard", () => {
    const result = parseRoutePattern("/protected/:path*");
    expect(result.isWildcard).toBe(true);
    expect(result.isParametrized).toBe(true);
    expect(result.priority).toBe(2);
  });
});

describe("[unit|base]: Route Matching", () => {
  test("[matchRoute|exact] - matches exact routes", () => {
    expect(matchRoute("/api/users", "/api/users")).toBe(true);
    expect(matchRoute("/api/users", "/api/posts")).toBe(false);
  });

  test("[matchRoute|wildcard] - matches wildcard routes", () => {
    expect(matchRoute("/api/*", "/api/users")).toBe(true);
    expect(matchRoute("/api/*", "/api/posts/123")).toBe(true);
    expect(matchRoute("/api/*", "/other/path")).toBe(false);
  });

  test("[matchRoute|parameterized] - matches parameterized routes", () => {
    expect(matchRoute("/api/users/:id", "/api/users/123")).toBe(true);
    expect(matchRoute("/api/users/:id", "/api/users/abc")).toBe(true);
    expect(matchRoute("/api/users/:id", "/api/posts/123")).toBe(false);
  });

  test("[matchRoute|trailingSlash] - handles trailing slashes", () => {
    expect(matchRoute("/api/users", "/api/users/")).toBe(true);
    expect(matchRoute("/api/users/", "/api/users")).toBe(true);
  });

  test("[matchRoute|nestedWildcard] - matches nested wildcards", () => {
    expect(matchRoute("/api/*", "/api/v1/users")).toBe(true);
    expect(matchRoute("/api/*", "/api/v1/posts/123/comments")).toBe(true);
  });
});

describe("[unit|base]: Route Priority Matching", () => {
  test("[findMatchingRoute|exact] - prioritizes exact matches over wildcards", () => {
    const routes: RouteConfig<string>[] = [
      { pattern: "/api/*", config: "wildcard" },
      { pattern: "/api/users", config: "exact" },
    ];

    const result = findMatchingRoute(routes, "/api/users");
    expect(result?.config).toBe("exact");
  });

  test("[findMatchingRoute|parameterized] - prioritizes parameterized over wildcards", () => {
    const routes: RouteConfig<string>[] = [
      { pattern: "/api/*", config: "wildcard" },
      { pattern: "/api/users/:id", config: "parameterized" },
    ];

    const result = findMatchingRoute(routes, "/api/users/123");
    expect(result?.config).toBe("parameterized");
  });

  test("[findMatchingRoute|notFound] - returns null when no match", () => {
    const routes: RouteConfig<string>[] = [
      { pattern: "/api/*", config: "wildcard" },
    ];

    const result = findMatchingRoute(routes, "/other/path");
    expect(result).toBeNull();
  });

  test("[findMatchingRoute|multipleWildcards] - matches longest wildcard first", () => {
    const routes: RouteConfig<string>[] = [
      { pattern: "/api/*", config: "api" },
      { pattern: "/api/v1/*", config: "v1" },
    ];

    const result = findMatchingRoute(routes, "/api/v1/users");
    expect(result?.config).toBe("v1");
  });
});

describe("[unit|base]: Route Configuration Validation", () => {
  test("[validateRouteConfig|valid] - accepts valid single route", () => {
    const result = validateRouteConfig({ route: "/api/users" });
    expect(result).toBeNull();
  });

  test("[validateRouteConfig|valid] - accepts valid routes array", () => {
    const result = validateRouteConfig({ routes: ["/api/users", "/api/*"] });
    expect(result).toBeNull();
  });

  test("[validateRouteConfig|valid] - accepts empty config", () => {
    const result = validateRouteConfig({});
    expect(result).toBeNull();
  });

  test("[validateRouteConfig|error] - rejects wildcard in route property", () => {
    const result = validateRouteConfig({ route: "/api/*" });
    expect(result).not.toBeNull();
    expect(result?.code).toBe("INVALID_ROUTE_PATTERN");
    expect(result?.message).toContain("routes array");
  });

  test("[validateRouteConfig|error] - rejects both route and routes", () => {
    const result = validateRouteConfig({
      route: "/api/users",
      routes: ["/api/posts"],
    });
    expect(result).not.toBeNull();
    expect(result?.code).toBe("INVALID_ROUTE_CONFIG");
  });
});
