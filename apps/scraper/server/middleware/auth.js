#!/usr/bin/env node

import { ApiKeyManager } from '../../src/tenant/api-key-manager.js';
import { TenantManager } from '../../src/tenant/tenant-manager.js';

const apiKeyManager = new ApiKeyManager();
const tenantManager = new TenantManager();

/**
 * Authentication Middleware
 * Validates API key and attaches tenant info to request
 */
export function authenticate(req, res, next) {
  // Extract API key from header
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'API key is required. Provide it via X-API-Key header or Authorization: Bearer <key>'
    });
  }

  // Validate API key
  const validation = apiKeyManager.validateApiKey(apiKey);

  if (!validation.valid) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: validation.error
    });
  }

  // Attach tenant info to request
  req.tenant = {
    id: validation.tenant_id,
    name: validation.tenant_name,
    email: validation.tenant_email,
    plan: validation.plan
  };

  req.apiKey = apiKey;

  next();
}

/**
 * Check tenant access to restaurant
 * Use after authenticate middleware
 */
export function checkRestaurantAccess(req, res, next) {
  const restaurantSlug = req.params.slug;
  const tenantId = req.tenant.id;

  if (!restaurantSlug) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Restaurant slug is required'
    });
  }

  // Check if tenant has access to this restaurant
  const hasAccess = tenantManager.hasAccess(tenantId, restaurantSlug);

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: `You do not have access to restaurant: ${restaurantSlug}`
    });
  }

  next();
}

/**
 * Log API usage
 * Use after authenticate middleware
 */
export function logApiUsage(req, res, next) {
  // Store original end function
  const originalEnd = res.end;

  // Override end to capture status code
  res.end = function(...args) {
    // Log the API usage
    apiKeyManager.logApiUsage({
      tenant_id: req.tenant.id,
      api_key: req.apiKey,
      endpoint: req.path,
      method: req.method,
      status_code: res.statusCode
    });

    // Call original end
    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Rate limiting middleware
 * Use after authenticate middleware
 */
export function rateLimit(req, res, next) {
  const tenantId = req.tenant.id;
  const plan = req.tenant.plan;

  // Check rate limit
  const rateLimitCheck = apiKeyManager.checkRateLimit(tenantId, plan, 60); // 60 minutes window

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', rateLimitCheck.limit);
  res.setHeader('X-RateLimit-Remaining', rateLimitCheck.remaining);
  res.setHeader('X-RateLimit-Window', '1 hour');

  if (!rateLimitCheck.under_limit) {
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Limit: ${rateLimitCheck.limit} requests per hour`,
      limit: rateLimitCheck.limit,
      current: rateLimitCheck.current,
      resetIn: '1 hour'
    });
  }

  next();
}

/**
 * Optional authentication (doesn't fail if no API key)
 * Useful for endpoints that work with or without auth
 */
export function optionalAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    // No API key provided, continue without auth
    req.tenant = null;
    req.apiKey = null;
    return next();
  }

  // Validate API key
  const validation = apiKeyManager.validateApiKey(apiKey);

  if (validation.valid) {
    req.tenant = {
      id: validation.tenant_id,
      name: validation.tenant_name,
      email: validation.tenant_email,
      plan: validation.plan
    };
    req.apiKey = apiKey;
  } else {
    req.tenant = null;
    req.apiKey = null;
  }

  next();
}

/**
 * Combined middleware: auth + rate limit + logging
 */
export function protectedRoute(req, res, next) {
  authenticate(req, res, (err) => {
    if (err) return next(err);

    rateLimit(req, res, (err) => {
      if (err) return next(err);

      logApiUsage(req, res, next);
    });
  });
}

/**
 * Combined middleware: auth + restaurant access + rate limit + logging
 */
export function protectedRestaurantRoute(req, res, next) {
  authenticate(req, res, (err) => {
    if (err) return next(err);

    checkRestaurantAccess(req, res, (err) => {
      if (err) return next(err);

      rateLimit(req, res, (err) => {
        if (err) return next(err);

        logApiUsage(req, res, next);
      });
    });
  });
}

export default {
  authenticate,
  checkRestaurantAccess,
  logApiUsage,
  rateLimit,
  optionalAuth,
  protectedRoute,
  protectedRestaurantRoute
};
