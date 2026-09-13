import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import type { Division } from '@mycorp24/agent-types';
import {
  formatFloor,
  resolveFloorStack,
  resolvePreset,
  sortTopDown,
} from '@mycorp24/business-logic';

/**
 * Mobile home — spec §74.
 *
 * This app has no data layer yet: no session, no API client, no database. So
 * it shows the one thing it can compute honestly — the shape of the building,
 * from the same shared packages the web app uses (§73, exercised rather than
 * asserted) — and says plainly that everything else lives on the web for now.
 *
 * It used to open with "오늘 직접 결정하셔야 할 일은 2건입니다" above two
 * invented approvals, addressed to a founder whose name was a constant in this
 * file. A founder reaching for their phone would have been told that two
 * decisions were waiting for them when none were. That is §151, on the screen
 * they check first, and a mock is not an excuse: nothing on it said so.
 */

export default function App() {
  const dark = useColorScheme() === 'dark';
  const t = dark ? darkTheme : lightTheme;

  // The default shape, not a claim about any particular company — this app
  // cannot know which company the reader owns until it can sign them in.
  const preset = resolvePreset('LOCAL_BUSINESS');
  const floors = sortTopDown(resolveFloorStack(preset.divisions as Division[]));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.ground }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.wordmark, { color: t.ink }]}>MYCORP24</Text>

        <Text style={[styles.greeting, { color: t.ink }]}>
          사장님에서, 회장님으로.
        </Text>

        <View style={[styles.card, { backgroundColor: t.paper, borderColor: t.line }]}>
          <Text style={[styles.cardTitle, { color: t.inkSoft }]}>준비 중</Text>
          <Text style={[styles.cardBody, { color: t.ink }]}>
            이 앱은 아직 회사에 연결되어 있지 않습니다. 결재와 아침 보고는
            웹에서 확인하실 수 있습니다.
          </Text>
          <Text style={[styles.note, { color: t.inkSoft }]}>
            AI prepares. Founder approves. Company executes.
          </Text>
        </View>

        <Text style={[styles.section, { color: t.inkSoft }]}>본사</Text>
        <View style={[styles.card, { backgroundColor: t.paper, borderColor: t.line }]}>
          {floors.map((f) => (
            <View key={String(f.floor)} style={styles.row}>
              <Text style={[styles.floorNum, { color: f.isTop ? t.ink : t.inkSoft }]}>
                {formatFloor(f)}
              </Text>
              <Text
                style={[
                  styles.floorName,
                  { color: t.ink, fontWeight: f.isTop ? '700' : '400' },
                ]}
              >
                {f.divisions.map((d) => d.ko).join(' · ')}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.footer, { color: t.inkSoft }]}>
          MYCORP24 by AMOV · Your Company. Always On.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const lightTheme = {
  ground: '#f6f7f9',
  paper: '#ffffff',
  ink: '#14161a',
  inkSoft: '#5b6270',
  line: '#e3e5ea',
};

const darkTheme = {
  ground: '#0e1013',
  paper: '#16181d',
  ink: '#f2f3f5',
  inkSoft: '#9aa1ae',
  line: '#2a2e36',
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 8 },
  wordmark: { fontSize: 13, fontWeight: '800', letterSpacing: 2, marginBottom: 20 },
  greeting: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4, marginBottom: 20 },
  section: { fontSize: 12, letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 2, padding: 16, gap: 6 },
  cardTitle: { fontSize: 12, letterSpacing: 1, marginBottom: 4 },
  cardBody: { fontSize: 15, lineHeight: 22 },
  note: { fontSize: 12, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: 3 },
  floorNum: { width: 56, fontSize: 12, fontVariant: ['tabular-nums'] },
  floorName: { fontSize: 14, flexShrink: 1 },
  footer: { fontSize: 12, marginTop: 28, textAlign: 'center' },
});
