import { useCallback, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

/** GitHub Pages에 배포되는 데모 사이트. URL 바에서 로컬 dev 서버 주소로 바꿀 수 있다. */
const DEFAULT_URL = 'https://guksu.github.io/wvkit/';

/**
 * 페이지의 console.error/warn과 visualViewport 변화를 RN 쪽으로 중계.
 * 실기기에서 DevTools 없이도 오류와 뷰포트 상태를 확인하기 위한 브리지.
 */
const CONSOLE_BRIDGE = `
(function () {
  function post(type, payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
  }
  ['error', 'warn'].forEach(function (level) {
    var original = console[level].bind(console);
    console[level] = function () {
      post('console.' + level, Array.prototype.slice.call(arguments).map(String).join(' '));
      original.apply(null, arguments);
    };
  });
  window.addEventListener('error', function (e) { post('console.error', String(e.message)); });
  window.addEventListener('unhandledrejection', function (e) { post('console.error', 'unhandledrejection: ' + String(e.reason)); });
  if (window.visualViewport) {
    var report = function () {
      post('viewport', {
        height: Math.round(window.visualViewport.height),
        width: Math.round(window.visualViewport.width),
        innerHeight: window.innerHeight,
      });
    };
    window.visualViewport.addEventListener('resize', report);
    report();
  }
  true;
})();
`;

interface LogEntry {
  level: 'error' | 'warn';
  text: string;
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [url, setUrl] = useState(DEFAULT_URL);
  const [urlDraft, setUrlDraft] = useState(DEFAULT_URL);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [viewport, setViewport] = useState('');
  const [showPanel, setShowPanel] = useState(false);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const { type, payload } = JSON.parse(event.nativeEvent.data);
      if (type === 'console.error' || type === 'console.warn') {
        const level = type === 'console.error' ? 'error' : 'warn';
        setLogs((prev) => [...prev.slice(-49), { level, text: String(payload) }]);
      } else if (type === 'viewport') {
        setViewport(`vv ${payload.width}×${payload.height} / inner ${payload.innerHeight}`);
      }
    } catch {
      // 데모 페이지 자체가 보내는 메시지가 아니면 무시
    }
  }, []);

  const navigate = useCallback(() => {
    Keyboard.dismiss();
    const next = /^https?:\/\//.test(urlDraft) ? urlDraft : `https://${urlDraft}`;
    setUrl(next);
    setLogs([]);
  }, [urlDraft]);

  const errorCount = logs.filter((l) => l.level === 'error').length;

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" />
      {/* WebView는 노치/홈 인디케이터 아래까지 풀블리드로 깔아야
          페이지의 viewport-fit=cover + env(safe-area-inset-*)가 실제 값을 받는다 */}
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        injectedJavaScript={CONSOLE_BRIDGE}
        onMessage={handleMessage}
        contentInsetAdjustmentBehavior="never"
        // iOS: 포커스 시 키보드가 프로그래매틱 focus()로도 열리도록 (StableInput 검증에 필요)
        keyboardDisplayRequiresUserAction={false}
        // iOS 네이티브 바운스는 켠 상태로 검증 — PullToRefresh/ScrollContainer의 실제 조건
        bounces
        webviewDebuggingEnabled
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {showPanel && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>
              {viewport || 'visualViewport 미지원'}
            </Text>
            <ScrollView style={styles.logScroll}>
              {logs.length === 0 ? (
                <Text style={styles.logEmpty}>콘솔 에러/경고 없음</Text>
              ) : (
                logs.map((log, i) => (
                  <Text
                    key={`${i}-${log.text.slice(0, 16)}`}
                    style={log.level === 'error' ? styles.logError : styles.logWarn}
                  >
                    [{log.level}] {log.text}
                  </Text>
                ))
              )}
            </ScrollView>
          </View>
        )}

        <View style={styles.toolbar}>
          <Pressable style={styles.button} onPress={() => webViewRef.current?.reload()}>
            <Text style={styles.buttonText}>↻</Text>
          </Pressable>
          <TextInput
            style={styles.urlInput}
            value={urlDraft}
            onChangeText={setUrlDraft}
            onSubmitEditing={navigate}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
          />
          <Pressable
            style={[styles.button, errorCount > 0 && styles.buttonAlert]}
            onPress={() => setShowPanel((v) => !v)}
          >
            <Text style={styles.buttonText}>{errorCount > 0 ? errorCount : '☰'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    // 홈 인디케이터를 피하는 여백 — 하네스 자체는 safe area 라이브러리 없이 최소로 유지
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#111',
  },
  urlInput: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#222',
    color: '#eee',
    fontSize: 13,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
  },
  buttonAlert: { backgroundColor: '#7f1d1d' },
  buttonText: { color: '#eee', fontSize: 15 },
  panel: {
    maxHeight: 220,
    backgroundColor: '#111',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
    padding: 12,
  },
  panelTitle: { color: '#9ca3af', fontSize: 12, marginBottom: 8 },
  logScroll: { maxHeight: 170 },
  logEmpty: { color: '#4ade80', fontSize: 12 },
  logError: { color: '#f87171', fontSize: 12, marginBottom: 4 },
  logWarn: { color: '#fbbf24', fontSize: 12, marginBottom: 4 },
});
