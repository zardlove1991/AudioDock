import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = exception.message;
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      if ((exceptionResponse as any).message) {
        message = Array.isArray((exceptionResponse as any).message)
          ? (exceptionResponse as any).message[0]
          : (exceptionResponse as any).message;
      }
    }

    // Force HTTP 200 status code
    response.status(HttpStatus.OK).json({
      code: status,
      message: message || 'error',
      data: null,
    });
  }
}
