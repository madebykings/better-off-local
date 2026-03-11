import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

// TODO: add integration tests
// Run with: flutter test integration_test/
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('App integration', () {
    testWidgets('placeholder test', (tester) async {
      expect(true, isTrue);
    });
  });
}
