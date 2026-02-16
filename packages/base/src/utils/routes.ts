export type RoutePattern = string;
export type RouteMatcher = (path: string) => boolean;

export interface RouteConfig<T = unknown> {
  pattern: RoutePattern;
  config: T;
}

export interface ParsedPattern {
  segments: string[];
  isWildcard: boolean;
  isParametrized: boolean;
  paramNames: string[];
  priority: number;
}

const PRIORITY_EXACT = 3;
const PRIORITY_PARAMETRIZED = 2;
const PRIORITY_WILDCARD = 1;

export function parseRoutePattern(pattern: string): ParsedPattern {
  const normalizedPattern = pattern.startsWith("/") ? pattern : `/${pattern}`;
  const segments = normalizedPattern.split("/").filter(Boolean);

  let isWildcard = false;
  let isParametrized = false;
  const paramNames: string[] = [];
  const seenParamNames = new Set<string>();
  const recordParamName = (name: string) => {
    if (!name) {
      return;
    }
    if (seenParamNames.has(name)) {
      return;
    }
    seenParamNames.add(name);
    paramNames.push(name);
  };

  for (const segment of segments) {
    if (segment === "*") {
      isWildcard = true;
      continue;
    }

    const hasWildcardToken = segment.includes("*");

    if (segment.startsWith(":")) {
      isParametrized = true;
      const paramName = segment.replace(/\*+$/, "").slice(1);
      recordParamName(paramName);
      if (hasWildcardToken) {
        isWildcard = true;
      }
      continue;
    }

    if (hasWildcardToken) {
      const parts = segment.split("*");
      for (const part of parts) {
        if (part.startsWith(":")) {
          isParametrized = true;
          recordParamName(part.slice(1));
        }
      }
      isWildcard = true;
    }
  }

  let priority = PRIORITY_WILDCARD;
  if (!isWildcard && !isParametrized) {
    priority = PRIORITY_EXACT;
  } else if (isParametrized && !isWildcard) {
    priority = PRIORITY_PARAMETRIZED;
  } else if (isParametrized && isWildcard) {
    priority = PRIORITY_PARAMETRIZED;
  }

  return { segments, isWildcard, isParametrized, paramNames, priority };
}

function matchSegment(patternSegment: string, pathSegment: string): boolean {
  if (patternSegment === "*") {
    return true;
  }

  if (patternSegment.startsWith(":")) {
    return true;
  }

  if (patternSegment.includes("*")) {
    const regex = new RegExp(
      "^" + patternSegment.replace(/\*/g, ".*").replace(/:/g, "") + "$"
    );
    return regex.test(pathSegment);
  }

  return patternSegment === pathSegment;
}

function matchWildcardPattern(
  patternSegments: string[],
  pathSegments: string[]
): boolean {
  const requiredSegments = patternSegments.filter((s) => s !== "*");

  if (requiredSegments.length > pathSegments.length) {
    return false;
  }

  for (let i = 0; i < requiredSegments.length; i++) {
    const patternIndex = patternSegments.indexOf(requiredSegments[i]);
    if (pathSegments[patternIndex] !== requiredSegments[i].replace(/^\:/, "")) {
      if (!requiredSegments[i].startsWith(":") && requiredSegments[i] !== "*") {
        return false;
      }
    }
  }

  return true;
}

export function matchRoute(pattern: string, path: string): boolean {
  const normalizedPattern = pattern.startsWith("/") ? pattern : `/${pattern}`;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedPattern === normalizedPath) {
    return true;
  }

  const parsed = parseRoutePattern(normalizedPattern);
  const patternSegments = parsed.segments;
  const pathSegments = normalizedPath.split("/").filter(Boolean);

  if (!parsed.isWildcard && patternSegments.length !== pathSegments.length) {
    return false;
  }

  if (parsed.isWildcard && patternSegments.length > pathSegments.length + 1) {
    return false;
  }

  if (parsed.isWildcard) {
    return matchWildcardPattern(patternSegments, pathSegments);
  }

  for (let i = 0; i < patternSegments.length; i++) {
    if (!matchSegment(patternSegments[i], pathSegments[i])) {
      return false;
    }
  }

  return true;
}

export function findMatchingRoute<T>(
  routes: RouteConfig<T>[],
  path: string
): RouteConfig<T> | null {
  const matchingRoutes: Array<{ route: RouteConfig<T>; parsed: ParsedPattern }> = [];

  for (const route of routes) {
    if (matchRoute(route.pattern, path)) {
      const parsed = parseRoutePattern(route.pattern);
      matchingRoutes.push({ route, parsed });
    }
  }

  if (matchingRoutes.length === 0) {
    return null;
  }

  matchingRoutes.sort((a, b) => {
    if (b.parsed.priority !== a.parsed.priority) {
      return b.parsed.priority - a.parsed.priority;
    }
    if (b.parsed.segments.length !== a.parsed.segments.length) {
      return b.parsed.segments.length - a.parsed.segments.length;
    }
    return b.route.pattern.length - a.route.pattern.length;
  });

  return matchingRoutes[0].route;
}

export interface RouteInputConfig {
  route?: string;
  routes?: string[];
}

export interface RouteValidationError {
  code: string;
  message: string;
  path?: string;
  value?: unknown;
  validOptions?: string[];
}

function containsWildcard(pattern: string): boolean {
  return pattern.includes("*");
}

export function validateRouteConfig(
  config: RouteInputConfig
): RouteValidationError | null {
  const { route, routes } = config;

  if (!route && !routes) {
    return null;
  }

  if (route && routes) {
    return {
      code: "INVALID_ROUTE_CONFIG",
      message: "Cannot specify both 'route' and 'routes'. Use 'route' for a single exact path or 'routes' for multiple paths.",
      path: "route",
      value: { route, routes },
    };
  }

  if (route && containsWildcard(route)) {
      return {
        code: "INVALID_ROUTE_PATTERN",
        message:
          "Wildcard routes must use the routes array, not 'route'. Use 'routes: [\"/api/*\"]' instead of 'route: \"/api/*\"'.",
        path: "route",
        value: route,
        validOptions: ['routes: ["/api/*"]', 'routes: ["/api/users", "/api/posts"]'],
      };
  }

  return null;
}
