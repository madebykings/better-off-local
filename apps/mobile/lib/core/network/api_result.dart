import '../errors/failure.dart';

/// Simple result type wrapping a success value or a [Failure].
sealed class ApiResult<T> {
  const ApiResult();
}

final class ApiSuccess<T> extends ApiResult<T> {
  const ApiSuccess(this.data);
  final T data;
}

final class ApiError<T> extends ApiResult<T> {
  const ApiError(this.failure);
  final Failure failure;
}

extension ApiResultX<T> on ApiResult<T> {
  bool get isSuccess => this is ApiSuccess<T>;
  bool get isError => this is ApiError<T>;

  T get data => (this as ApiSuccess<T>).data;
  Failure get failure => (this as ApiError<T>).failure;

  R when<R>({
    required R Function(T data) success,
    required R Function(Failure failure) error,
  }) {
    return switch (this) {
      ApiSuccess<T> s => success(s.data),
      ApiError<T> e => error(e.failure),
    };
  }
}
