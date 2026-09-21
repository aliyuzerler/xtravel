import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '@turizm-pazaryeri/shared';

/**
 * Başarılı yanıtları A7'nin belirlediği { success: true, data } formatına sarmalar.
 * - Eğer controller zaten success:true döndüyse dokunmaz.
 * - 204 No Content yanıtlarına müdahale etmez.
 * - Buffer / Stream yanıtlarına dokunmaz (file download vb.).
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // No content
        if (data === undefined || data === null) {
          response.status(response.statusCode || 200);
          return { success: true, data: null } as ApiResponse<null>;
        }

        // Stream/Buffer yanıtları (dosya indirme vb.)
        if (data instanceof Buffer || typeof data === 'string') {
          return data as T;
        }

        // Controller zaten ApiResponse formatında (paginate vb.)
        if (
          typeof data === 'object' &&
          data !== null &&
          'success' in data &&
          (data as any).success === true
        ) {
          return data;
        }

        return { success: true, data } as ApiResponse<T>;
      }),
    );
  }
}
