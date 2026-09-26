import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { csrfProtection } from '../server/security';

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
  PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
  VITE_PUBLIC_SITE_URL: process.env.VITE_PUBLIC_SITE_URL,
  REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
  REPLIT_DOMAINS: process.env.REPLIT_DOMAINS,
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  for (const key of Object.keys(originalEnv) as (keyof typeof originalEnv)[]) {
    delete process.env[key];
  }
  process.env.NODE_ENV = 'production';
  process.env.VITE_PUBLIC_SITE_URL = 'https://www.thebutterbakery.com';
  process.env.APP_PUBLIC_URL = 'https://thebutterbakery.com';
  process.env.REPLIT_DEV_DOMAIN = 'this-app.replit.dev';
  process.env.REPLIT_DOMAINS = 'this-app.replit.app, this-app.onrender.com';
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of Object.keys(originalEnv) as (keyof typeof originalEnv)[]) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function check(options: {
  origin?: string;
  referer?: string;
  host?: string;
  forwardedHost?: string;
  protocol?: string;
  method?: string;
} = {}): boolean {
  const headers: Record<string, string | undefined> = {
    host: options.host ?? 'this-app.replit.dev',
    origin: options.origin,
    referer: options.referer,
    'x-forwarded-host': options.forwardedHost,
  };
  const req = {
    method: options.method ?? 'POST',
    path: '/api/test',
    protocol: options.protocol ?? 'https',
    headers,
  } as unknown as Request;
  const next = vi.fn();
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  csrfProtection(req, { status } as unknown as Response, next as NextFunction);
  expect(next.mock.calls.length + status.mock.calls.length).toBe(1);
  if (status.mock.calls.length) expect(status).toHaveBeenCalledWith(403);
  return next.mock.calls.length === 1;
}

describe('csrfProtection app origins', () => {
  it('permits exact configured production, preview and deployment origins', () => {
    for (const origin of [
      'https://www.thebutterbakery.com',
      'https://thebutterbakery.com',
      'https://this-app.replit.dev',
      'https://this-app.replit.app',
      'https://this-app.onrender.com',
    ]) {
      expect(check({ origin })).toBe(true);
    }
    expect(check({ referer: 'https://this-app.replit.dev/dashboard?tab=1' })).toBe(true);
    expect(check({ method: 'GET' })).toBe(true);
  });

  it('rejects another tenant targeting the app, even with a spoofed forwarded Host', () => {
    for (const origin of [
      'https://attacker.replit.dev',
      'https://attacker.replit.app',
      'https://attacker.onrender.com',
      'https://this-app.replit.dev.attacker.com',
    ]) {
      expect(check({ origin, host: 'this-app.replit.dev', forwardedHost: new URL(origin).host })).toBe(false);
    }
    expect(check({ origin: 'https://attacker.com', forwardedHost: 'attacker.com' })).toBe(false);
  });

  it('rejects missing or malformed sources, including invalid Origin with valid Referer', () => {
    for (const origin of [
      'null', 'not-a-url', 'https://www.thebutterbakery.com/path',
      'https://www.thebutterbakery.com?x=1',
      'https://www.thebutterbakery.com@attacker.com',
      'https://www.thebutterbakery.com#fragment',
      'https://www.thebutterbakery.com, https://attacker.com',
    ]) {
      expect(check({ origin, referer: 'https://this-app.replit.dev/' })).toBe(false);
    }
    expect(check()).toBe(false);
    expect(check({ referer: 'null' })).toBe(false);
  });

  it('requires configured protocols and exact ports', () => {
    expect(check({ origin: 'http://this-app.replit.dev' })).toBe(false);
    expect(check({ origin: 'https://this-app.replit.dev:8443' })).toBe(false);
    expect(check({ origin: 'http://www.thebutterbakery.com' })).toBe(false);
    process.env.PUBLIC_SITE_URL = 'https://custom.example:8443';
    expect(check({ origin: 'https://custom.example:8443' })).toBe(true);
    expect(check({ origin: 'https://custom.example' })).toBe(false);
  });

  it('allows exact same-origin requests on an unconfigured production custom domain', () => {
    delete process.env.APP_PUBLIC_URL;
    delete process.env.PUBLIC_SITE_URL;
    delete process.env.VITE_PUBLIC_SITE_URL;
    delete process.env.REPLIT_DEV_DOMAIN;
    delete process.env.REPLIT_DOMAINS;
    expect(check({ origin: 'https://production.example', host: 'production.example' })).toBe(true);
    expect(check({ referer: 'https://production.example/orders', host: 'production.example' })).toBe(true);
    expect(check({ origin: 'https://other.example', host: 'production.example' })).toBe(false);
    expect(check({ origin: 'http://production.example', host: 'production.example' })).toBe(false);
    expect(check({ origin: 'https://production.example:8443', host: 'production.example' })).toBe(false);
    expect(check({ origin: 'https://production.example:8443', host: 'production.example:8443' })).toBe(true);
    expect(check({ origin: 'https://production.example', host: 'attacker.com@production.example' })).toBe(false);
    expect(check({ origin: 'https://production.example', host: 'production.example,attacker.com' })).toBe(false);
  });

  it('allows only matching localhost origins in development and production', () => {
    process.env.NODE_ENV = 'development';
    expect(check({ origin: 'http://localhost:5000', host: 'localhost:5000', protocol: 'http' })).toBe(true);
    expect(check({ origin: 'http://localhost:5001', host: 'localhost:5000', protocol: 'http' })).toBe(false);
    expect(check({ origin: 'http://attacker.replit.dev', host: 'this-app.replit.dev', protocol: 'http' })).toBe(false);
    process.env.NODE_ENV = 'production';
    expect(check({ origin: 'http://localhost:5000', host: 'localhost:5000', protocol: 'http' })).toBe(true);
  });
});