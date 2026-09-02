import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRouteFunction = (req: Request, res: Response, next: NextFunction) => unknown;

/**
 * Express 4, async handler'lardan dönen rejected promise'leri yakalamaz: red
 * unhandled rejection olarak süreci düşürür (Node 15+) ve istek yanıtsız kalır.
 * asyncHandler redleri next()'e yönlendirerek merkezi errorHandler'a ulaştırır
 * (MP-0.5).
 */
export function asyncHandler(fn: AsyncRouteFunction): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const AsyncFunctionConstructor = (async () => {}).constructor;

function isAsyncFunction(value: unknown): value is (...args: unknown[]) => Promise<unknown> {
  return typeof value === "function" && value instanceof AsyncFunctionConstructor;
}

type RouteRegistrar = (path: string, ...handlers: RequestHandler[]) => unknown;

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

/**
 * Router seviyesinde MP-0.5 uygulaması: bu çağrıdan SONRA router'a kaydedilen
 * her async fonksiyon (route handler ya da attachAuth/restrictTo gibi
 * middleware) otomatik olarak asyncHandler ile sarmalanır; redler merkezi
 * errorHandler'a akar. Senkron fonksiyonlar değişmez — Express onlardan
 * gelen hataları zaten next() ile iletir.
 */
export function autoAsyncHandlers(router: Router): Router {
  for (const method of HTTP_METHODS) {
    const register = (router[method] as unknown as RouteRegistrar).bind(router);

    (router as unknown as Record<string, unknown>)[method] = (
      path: string,
      ...handlers: RequestHandler[]
    ) =>
      register(
        path,
        ...handlers.map((handler) =>
          isAsyncFunction(handler)
            ? asyncHandler(handler as unknown as AsyncRouteFunction)
            : handler,
        ),
      );
  }

  return router;
}
