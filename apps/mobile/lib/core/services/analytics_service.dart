// TODO: implement using preferred analytics provider

abstract class AnalyticsService {
  Future<void> logEvent(String name, {Map<String, Object>? parameters});

  Future<void> setUserId(String? userId);

  Future<void> logScreenView(String screenName);
}
